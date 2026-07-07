import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { pb } from '@/db/pb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { BarChart3, TrendingUp, Star, Target, Send, Inbox, Award, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell,
} from 'recharts';
import { DIMENSION_LABELS, DIMENSIONS } from '@/types/types';
import MonthSelector from '@/components/MonthSelector';
import { motion, AnimatePresence } from 'framer-motion';

type ViewTab = 'sent' | 'received';

interface PersonStat {
  userId: string;
  userName: string;
  avgScore: number;
  reviewCount: number;
  dimensionScores: Record<string, number>;
  rank?: number;
  trend?: 'up' | 'down' | 'same';
}

// 增强后的统计数据（包含预计算的显示名和排名图标）
interface EnhancedStat extends PersonStat {
  displayName: string;
  trendIcon: React.ReactNode;
  rankBadgeStyle: string;
}

// ===== 辅助函数（纯函数，放组件外） =====
const getSuit = (score: number) => {
  if (score >= 4.0) return '♠';
  if (score >= 3.0) return '♥';
  if (score >= 2.0) return '♦';
  return '♣';
};

const pokerRanks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];


const getBarColor = (score: number) => {
  if (score >= 4) return '#10b981';
  if (score >= 3) return '#3b82f6';
  if (score >= 2) return '#f59e0b';
  return '#ef4444';
};

const getRankBadgeStyle = (rank: number) => {
  if (rank === 1) return 'bg-gradient-to-br from-amber-400 to-amber-500 text-white';
  if (rank === 2) return 'bg-gradient-to-br from-slate-300 to-slate-400 text-white';
  if (rank === 3) return 'bg-gradient-to-br from-orange-400 to-orange-500 text-white';
  return 'bg-slate-100 text-slate-600';
};

const getTrendIcon = (rank: number, totalLength: number): React.ReactNode => {
  if (rank <= 3) return <ArrowUp className="h-3.5 w-3.5 text-green-500" />;
  if (rank >= totalLength - 1 && totalLength > 3) return <ArrowDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-slate-400" />;
};

// ========== 自定义 Tooltip（memo） ==========
const CustomTooltip = memo(({ active, payload, label, data }: any) => {
  if (active && payload && payload.length) {
    const dataItem = data.find((item: any) => item.name === label);
    return (
      <div className="bg-white p-2 border border-slate-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-slate-900">{dataItem?.fullName || label}</p>
        <p className="text-xs text-slate-600">
          平均分: <span className="font-bold text-blue-600">{payload[0].value}</span> 分
        </p>
      </div>
    );
  }
  return null;
});
CustomTooltip.displayName = 'CustomTooltip';

// ========== 概述卡片（memo） ==========
const OverviewCard = memo(function OverviewCard({
  title,
  value,
  suffix,
  icon,
  color,
  desc,
}: {
  title: string;
  value: string | number;
  suffix: string;
  icon: React.ReactNode;
  color: 'blue' | 'amber' | 'emerald';
  desc: string;
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-xs text-slate-500 font-medium mb-1">{title}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900">{value}</span>
          <span className="text-xs text-slate-500">{suffix}</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">{desc}</p>
      </div>
      <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
    </div>
  );
});

// ========== 主组件 ==========
export default function MyStatsPage() {
  const { profile } = useAuth();
  const [selectedCycle, setSelectedCycle] = useState('');
  const [activeTab, setActiveTab] = useState<ViewTab>('received');
  const [sentStats, setSentStats] = useState<PersonStat[]>([]);
  const [receivedStats, setReceivedStats] = useState<PersonStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartAnimKey, setChartAnimKey] = useState(0);

  const canSend = profile?.role !== 'reviewee_only';

  useEffect(() => {
    if (!canSend && activeTab === 'sent') setActiveTab('received');
  }, [canSend, activeTab]);

  // 加载评价数据并计算统计
  useEffect(() => {
    if (!selectedCycle || !profile) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const result = await pb.collection('reviews').getList(1, 500, { sort: '-created' });
        const cycleReviews = result.items.filter((r: any) => {
          const cycleId = typeof r.cycle_id === 'string' ? r.cycle_id : r.cycle_id?.id;
          return cycleId === selectedCycle;
        });

        const userIds = new Set<string>();
        cycleReviews.forEach((r: any) => {
          if (r.from_user) userIds.add(r.from_user);
          if (r.to_user) userIds.add(r.to_user);
        });

        const usersMap = new Map<string, string>();
        if (userIds.size > 0) {
          const usersResult = await pb.collection('users').getList(1, 200);
          usersResult.items.forEach((user: any) => {
            usersMap.set(user.id, user.display_name || user.username || '未知');
          });
        }

        const parsedReviews = cycleReviews.map((r: any) => {
          let content: Record<string, any> = {};
          try { content = typeof r.content === 'string' ? JSON.parse(r.content) : r.content; } catch {}
          return {
            id: r.id,
            from_user: r.from_user,
            to_user: r.to_user,
            from_user_name: usersMap.get(r.from_user) || '匿名',
            to_user_name: usersMap.get(r.to_user) || '未知',
            content,
          };
        });

        // 计算发出统计
        const sentMap = new Map<string, PersonStat>();
        parsedReviews.filter(r => r.from_user === profile.id).forEach(rev => {
          if (!sentMap.has(rev.to_user)) {
            sentMap.set(rev.to_user, {
              userId: rev.to_user,
              userName: rev.to_user_name,
              avgScore: 0,
              reviewCount: 0,
              dimensionScores: {},
            });
          }
          const stat = sentMap.get(rev.to_user)!;
          stat.reviewCount++;
          let total = 0, count = 0;
          DIMENSIONS.forEach(dim => {
            const score = rev.content[dim]?.score || 0;
            if (!stat.dimensionScores[dim]) stat.dimensionScores[dim] = 0;
            stat.dimensionScores[dim] += score;
            if (score > 0) { total += score; count++; }
          });
          stat.avgScore = count > 0 ? total / count : 0;
        });

        // 计算收到统计
        const receivedMap = new Map<string, PersonStat>();
        parsedReviews.filter(r => r.to_user === profile.id).forEach(rev => {
          if (!receivedMap.has(rev.from_user)) {
            receivedMap.set(rev.from_user, {
              userId: rev.from_user,
              userName: rev.from_user_name,
              avgScore: 0,
              reviewCount: 0,
              dimensionScores: {},
            });
          }
          const stat = receivedMap.get(rev.from_user)!;
          stat.reviewCount++;
          let total = 0, count = 0;
          DIMENSIONS.forEach(dim => {
            const score = rev.content[dim]?.score || 0;
            if (!stat.dimensionScores[dim]) stat.dimensionScores[dim] = 0;
            stat.dimensionScores[dim] += score;
            if (score > 0) { total += score; count++; }
          });
          stat.avgScore = count > 0 ? total / count : 0;
        });

        const sentArray = Array.from(sentMap.values()).sort((a, b) => b.avgScore - a.avgScore);
        const receivedArray = Array.from(receivedMap.values()).sort((a, b) => b.avgScore - a.avgScore);

        setSentStats(sentArray.map((s, i) => ({ ...s, rank: i + 1 })));
        setReceivedStats(receivedArray.map((s, i) => ({ ...s, rank: i + 1 })));
        setChartAnimKey(prev => prev + 1);
      } catch {
        toast.error('加载统计数据失败');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedCycle, profile]);

  // 当前活跃的统计数据
  const currentStats = activeTab === 'sent' ? sentStats : receivedStats;

  // 一次性预计算增强数据（包含 displayName, trend, rankBadge）
  const enhancedStats = useMemo<EnhancedStat[]>(() => {
    const stats = currentStats;
    return stats.map(stat => {
      const rank = stat.rank!;
      let displayName: string;
      if (activeTab === 'sent') {
        displayName = stat.userName;
      } else {
        const suit = getSuit(stat.avgScore);
        const rankLabel = pokerRanks[rank - 1] || `${rank}`;
        displayName = `${rankLabel} ${suit}`;
      }
      return {
        ...stat,
        displayName,
        trendIcon: getTrendIcon(rank, stats.length),
        rankBadgeStyle: getRankBadgeStyle(rank),
      };
    });
  }, [currentStats, activeTab]);

  // 维度平均分
  const dimAverages = useMemo(() => {
    const avgs: Record<string, number> = {};
    DIMENSIONS.forEach(dim => {
      const scores = currentStats.map(s => s.dimensionScores[dim] || 0);
      avgs[dim] = currentStats.length ? scores.reduce((a, b) => a + b, 0) / currentStats.length : 0;
    });
    return avgs;
  }, [currentStats]);

  // 汇总数据
  const totalReviews = currentStats.reduce((sum, s) => sum + s.reviewCount, 0);
  const totalScore = currentStats.reduce((sum, s) => sum + s.avgScore * s.reviewCount, 0);
  const avgScore = totalReviews > 0 ? totalScore / totalReviews : 0;

  // 柱状图数据（前10）
  const rankingData = useMemo(() => {
    return enhancedStats.slice(0, 10).map(stat => ({
      name: stat.displayName.length > 8 ? stat.displayName.slice(0, 6) + '..' : stat.displayName,
      fullName: stat.displayName,
      score: Number(stat.avgScore.toFixed(2)),
    }));
  }, [enhancedStats]);

  // 雷达图数据
  const radarData = useMemo(() => {
    return DIMENSIONS.map(dim => ({
      subject: DIMENSION_LABELS[dim],
      score: Number(dimAverages[dim]?.toFixed(2) || 0),
      fullMark: 5,
    }));
  }, [dimAverages]);

  if (!profile) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">请先登录</p></div>;
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden select-none">
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">我的统计</h1>
            <p className="text-xs text-slate-500">查看您收到和发出的评价数据统计</p>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm shrink-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">查看月份</span>
            <MonthSelector selectedCycle={selectedCycle} onCycleChange={setSelectedCycle} className="w-40" />
          </div>

          <div className="h-8 w-px bg-slate-200" />

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('received')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium border text-sm ${
                activeTab === 'received'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Inbox className="h-4 w-4" /> 收到的评价
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${activeTab === 'received' ? 'bg-white/20' : 'bg-slate-100'}`}>
                {receivedStats.length}
              </span>
            </button>
            {canSend && (
              <button
                onClick={() => setActiveTab('sent')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium border text-sm ${
                  activeTab === 'sent'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Send className="h-4 w-4" /> 发出的评价
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${activeTab === 'sent' ? 'bg-white/20' : 'bg-slate-100'}`}>
                  {sentStats.length}
                </span>
              </button>
            )}
          </div>
        </motion.div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        ) : currentStats.length === 0 ? (
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="text-center text-slate-500 py-16">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>{activeTab === 'received' ? '本月暂无收到的评价' : '本月暂无发出的评价'}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <OverviewCard
                title={activeTab === 'received' ? '评价人数' : '已评价人数'}
                value={currentStats.length}
                suffix="人"
                icon={activeTab === 'received' ? <Inbox className="h-4 w-4 text-blue-600" /> : <Send className="h-4 w-4 text-blue-600" />}
                color="blue"
                desc={activeTab === 'received' ? `本月共${currentStats.length}人评价了您（匿名展示）` : `本月您共评价了${currentStats.length}人`}
              />
              <OverviewCard
                title="平均打分"
                value={avgScore.toFixed(2)}
                suffix="分"
                icon={<Star className="h-4 w-4 text-amber-500" />}
                color="amber"
                desc="所有维度的平均得分"
              />
              <OverviewCard
                title="评价维度"
                value={DIMENSIONS.length}
                suffix="个"
                icon={<Target className="h-4 w-4 text-emerald-600" />}
                color="emerald"
                desc={`共${DIMENSIONS.length}个评价维度`}
              />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      {activeTab === 'received' ? '匿名评价人评分排名' : '我给的评分排名'}
                    </CardTitle>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">按平均分从高到低（展示前10名）</p>
                </CardHeader>
                <CardContent className="p-4 h-[460px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankingData} margin={{ top: 20, right: 20, left: 20, bottom: 60 }} barGap={8} barCategoryGap="15%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ angle: activeTab === 'sent' ? -20 : 0, textAnchor: activeTab === 'sent' ? 'end' : 'middle', fontSize: 11, fill: '#334155' }}
                        interval={0}
                        height={70}
                        tickLine={false}
                      />
                      <YAxis domain={[0, 5]} tickCount={6} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip data={rankingData} />} cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={60} animationDuration={1500} animationEasing="ease-out">
                        {rankingData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={getBarColor(entry.score)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-base font-bold text-slate-900">维度分布</CardTitle>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">鼠标悬浮查看维度名称</p>
                </CardHeader>
                <CardContent className="p-4 h-[440px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData} key={chartAnimKey}>
                      <PolarGrid stroke="#e2e8f0" strokeWidth={0.8} />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155', fontSize: 12 }} axisLine={false} />
                      <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} tick={{ fill: '#cbd5e1', fontSize: 9 }} axisLine={false} />
                      <Radar
                        name="维度"
                        dataKey="score"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fill="#3b82f6"
                        fillOpacity={0.28}
                        animationDuration={1800}
                        animationEasing="ease-out"
                        activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2, fill: '#fff', activeR: 10 }}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 3px 10px rgba(0,0,0,0.06)', padding: '6px 10px' }}
                        labelFormatter={(_, payload) => payload?.[0]?.subject ?? ''}
                        formatter={(value: any) => [`${value} 分`, '平均得分']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">
                        {activeTab === 'received' ? '匿名评价详情' : '我评价的成员详情'}
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-1">共 {currentStats.length} 条记录</p>
                    </div>
                    <Badge variant="secondary" className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700">按平均分排序</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <AnimatePresence>
                      {enhancedStats.map((stat, index) => (
                        <motion.div
                          key={stat.userId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' }}
                          className="border border-slate-200 rounded-xl p-4 transition-all bg-white"
                        >
                          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${stat.rankBadgeStyle}`}>
                                {stat.rank}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-semibold text-slate-900">{stat.displayName}</span>
                                {stat.trendIcon}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                              <span className="text-lg font-bold text-blue-700">{stat.avgScore.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {DIMENSIONS.map(dim => {
                              const score = stat.dimensionScores[dim] || 0;
                              const percentage = (score / 5) * 100;
                              return (
                                <div key={dim} className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-600 font-medium">{DIMENSION_LABELS[dim]}</span>
                                    <span className="font-bold text-slate-900">{score.toFixed(1)}</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}