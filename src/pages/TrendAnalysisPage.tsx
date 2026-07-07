import { useState, useEffect, useMemo, memo } from 'react';
import { pb } from '@/db/pb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { DIMENSIONS, Profile, ReviewRecord, MonthCycle } from '@/types/types';
import MonthSelector from '@/components/MonthSelector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Users, Star, ChevronDown, User, UserCheck, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface UserStat {
  count: number;
  totalScore: number;
}

interface AggregatedData {
  month: string;
  monthLabel: string;
  users: Map<string, UserStat>;
}

interface ChartDataPoint {
  month: string;
  [userId: string]: number | null;
}

type ViewMode = 'reviewer' | 'reviewee';
type ViewMetric = 'count' | 'score';

const getScoreColor = (val: number | null, isCount: boolean) => {
  if (val === null || val === 0) return 'transparent';
  if (isCount) {
    const ratio = Math.min(val / 20, 1);
    return `rgba(99, 102, 241, ${0.1 + 0.5 * ratio})`;
  } else {
    const ratio = Math.min(val / 5, 1);
    return `rgba(16, 185, 129, ${0.1 + 0.5 * ratio})`;
  }
};

const aggregateTrendData = (reviews: ReviewRecord[], cycles: MonthCycle[], userRole: 'from_user' | 'to_user'): Map<string, AggregatedData> => {
  const monthMap = new Map<string, AggregatedData>();
  cycles.forEach((cycle) => {
    const monthKey = cycle.start_date.slice(0, 7);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        monthLabel: `${monthKey.slice(0, 4)}年${parseInt(monthKey.slice(5))}月`,
        users: new Map()
      });
    }
  });

  reviews.forEach((review) => {
    const userId = review[userRole];
    if (!userId) return;
    const cycleId = typeof review.cycle_id === 'string' ? review.cycle_id : (review.cycle_id as any)?.id;
    const cycle = cycles.find((c) => c.id === cycleId);
    if (!cycle) return;
    const monthKey = cycle.start_date.slice(0, 7);
    const data = monthMap.get(monthKey);
    if (!data) return;

    if (!data.users.has(userId)) {
      data.users.set(userId, { count: 0, totalScore: 0 });
    }
    const stat = data.users.get(userId)!;
    stat.count++;

    let content: ReviewRecord['content'];
    try {
      content = typeof review.content === 'string' ? JSON.parse(review.content) : review.content;
    } catch {}

    let totalDimScore = 0;
    let dimCount = 0;
    DIMENSIONS.forEach((dim) => {
      if (content && content[dim]?.score !== undefined) {
        totalDimScore += content[dim].score;
        dimCount++;
      }
    });
    const reviewAvg = dimCount > 0 ? totalDimScore / dimCount : 0;
    stat.totalScore += reviewAvg;
  });

  return monthMap;
};

const transformToChartData = (aggregatedMap: Map<string, AggregatedData>, selectedIds: string[], metric: ViewMetric): ChartDataPoint[] => {
  const result: ChartDataPoint[] = [];
  const sortedMonths = Array.from(aggregatedMap.keys()).sort();

  sortedMonths.forEach(monthKey => {
    const dataPoint: ChartDataPoint = { month: aggregatedMap.get(monthKey)!.monthLabel };
    let hasData = false;
    selectedIds.forEach(id => {
      const users = aggregatedMap.get(monthKey)!.users;
      const stat = users.get(id);
      let value: number | null = null;
      if (stat && stat.count > 0) {
        value = metric === 'count' ? stat.count : Number((stat.totalScore / stat.count).toFixed(2));
        hasData = true;
      }
      dataPoint[id] = value;
    });
    if (hasData) result.push(dataPoint);
  });

  return result;
};

interface FilterDropdownProps {
  list: { id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  label: string;
}

const UserFilterDropdown = memo(({ list, selectedIds, onToggle, onToggleAll, label }: FilterDropdownProps) => {
  const isAllSelected = list.length > 0 && selectedIds.length === list.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-8 px-3 text-sm border-slate-200 min-w-[120px] justify-between bg-white">
          {isAllSelected ? `全部${label}` : `已选 ${selectedIds.length} 人`}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 p-2 max-h-64 overflow-y-auto">
        <div className="flex items-center gap-2 px-1 py-1 border-b border-slate-100 mb-1">
          <button onClick={onToggleAll} className="text-sm text-indigo-600 hover:underline">{isAllSelected ? '取消全选' : '全选'}</button>
        </div>
        {list.map((item) => (
          <div key={item.id} className="flex items-center space-x-2 py-1 px-1 hover:bg-slate-50 rounded">
            <input type="checkbox" id={`item-${item.id}`} checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <label htmlFor={`item-${item.id}`} className="text-sm cursor-pointer select-none truncate">{item.name}</label>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
UserFilterDropdown.displayName = 'UserFilterDropdown';

interface TrendTableProps {
  chartData: ChartDataPoint[];
  sortedIds: string[];
  userList: { id: string; name: string }[];
  viewMetric: ViewMetric;
  colors: string[];
}

const TrendTable = memo(({ chartData, sortedIds, userList, viewMetric, colors }: TrendTableProps) => {
  if (chartData.length === 0) return null;
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">月度汇总 <span className="ml-2 text-xs font-normal text-slate-400">（ {viewMetric === 'count' ? '数量' : '平均分'}）</span></h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
            <tr>
              <th className="sticky left-0 bg-slate-100 z-20 p-3 border-r border-slate-200 min-w-[90px] font-semibold">月份</th>
              {sortedIds.map((id, idx) => {
                const user = userList.find(u => u.id === id);
                const color = colors[idx % colors.length];
                return (
                  <th key={id} className="p-3 text-center min-w-[80px] border-r border-slate-200 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="truncate max-w-[80px]">{user?.name || '未知'}</span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {chartData.map((item) => (
              <tr key={item.month} className="hover:bg-indigo-50/50 transition-colors">
                <td className="sticky left-0 bg-white z-10 p-3 font-medium border-r border-slate-200 text-slate-700">{item.month}</td>
                {sortedIds.map((id) => {
                  const val = item[id];
                  const display = val !== undefined && val !== null ? val : '-';
                  const isCount = viewMetric === 'count';
                  const bgColor = getScoreColor(val !== undefined && val !== null ? val : null, isCount);
                  return (
                    <td key={id} className="p-3 text-center border-r border-slate-200" style={{ backgroundColor: bgColor }}>
                      {isCount ? display : display !== '-' ? Number(display).toFixed(2) : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
TrendTable.displayName = 'TrendTable';

export default function TrendAnalysisPage() {
  const { profile } = useAuth();
  const canAccess = profile?.role === 'admin' || profile?.role === 'reviewer';

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('reviewee');
  const [viewMetric, setViewMetric] = useState<ViewMetric>('score');
  const [aggregatedMap, setAggregatedMap] = useState<Map<string, AggregatedData>>(new Map());
  const [userList, setUserList] = useState<{ id: string; name: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCycle, setSelectedCycle] = useState('');

  useEffect(() => {
    if (!profile || !canAccess) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const cyclesResult = await pb.collection('month_cycles').getList(1, 100, { sort: 'start_date' });
        const cyclesData = cyclesResult.items;

        const reviewsResult = await pb.collection('reviews').getList<ReviewRecord>(1, 5000, { sort: '-created' });
        let allReviews = reviewsResult.items;

        // 如果选择了特定周期，只加载该周期的数据
        if (selectedCycle) {
          allReviews = allReviews.filter((r) => {
            const cycleId = typeof r.cycle_id === 'string' ? r.cycle_id : (r.cycle_id as any)?.id;
            return cycleId === selectedCycle;
          });
        }

        const usersResult = await pb.collection('users').getList<Profile>(1, 200);
        const userMap = new Map<string, string>();
        usersResult.items.forEach((u) => {
          userMap.set(u.id, u.display_name || u.username || '未知');
        });

        const reviewers = usersResult.items.filter((u) => u.role === 'admin' || u.role === 'reviewer');
        const reviewerListData = reviewers.map((u) => ({ id: u.id, name: userMap.get(u.id) || '未知' }));
        const revieweeListData = usersResult.items.map((u) => ({ id: u.id, name: userMap.get(u.id) || '未知' }));

        const currentList = viewMode === 'reviewer' ? reviewerListData : revieweeListData;
        setUserList(currentList);
        setSelectedIds(currentList.map(r => r.id));

        const map = aggregateTrendData(allReviews, cyclesData, viewMode === 'reviewer' ? 'from_user' : 'to_user');
        setAggregatedMap(map);
      } catch (error) {
        console.error(error);
        toast.error('加载趋势数据失败');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [profile, canAccess, viewMode, selectedCycle]);

  const chartData = useMemo(() => transformToChartData(aggregatedMap, selectedIds, viewMetric), [aggregatedMap, selectedIds, viewMetric]);

  const sortedSelectedIds = useMemo(() => {
    if (!chartData.length || selectedIds.length === 0) return selectedIds;
    const stats: Record<string, { validCount: number; total: number }> = {};
    selectedIds.forEach((id) => {
      let validCount = 0;
      let total = 0;
      chartData.forEach((item) => {
        const val = item[id];
        if (val !== undefined && val !== null && val !== 0) {
          validCount++;
          total += Number(val);
        }
      });
      stats[id] = { validCount, total };
    });

    return [...selectedIds].sort((a, b) => {
      const aCount = stats[a]?.validCount || 0;
      const bCount = stats[b]?.validCount || 0;
      if (aCount !== bCount) return bCount - aCount;
      return (stats[b]?.total || 0) - (stats[a]?.total || 0);
    });
  }, [selectedIds, chartData]);

  const handleToggleItem = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]);
  const handleToggleAll = () => {
    if (selectedIds.length === userList.length) setSelectedIds([]);
    else setSelectedIds(userList.map(r => r.id));
  };
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setViewMetric(mode === 'reviewer' ? 'count' : 'score');
  };

  const colors = useMemo(() => ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'], []);

  const metricOptions = [
    { value: 'count' as const, label: viewMode === 'reviewer' ? '评价数' : '收到评价数' },
    { value: 'score' as const, label: '平均分' },
  ];

  if (!canAccess) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">仅管理员可访问此页面</p></div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden select-none">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">评价趋势分析</h1>
              <p className="text-xs text-slate-500">查看评价活跃度与成员得分变化</p>
            </div>
          </div>

          {/* 右侧视图切换 */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg shrink-0">
            <button onClick={() => handleViewModeChange('reviewee')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${viewMode === 'reviewee' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>
              <UserCheck className="w-4 h-4" /> 成员得分
            </button>
            <button onClick={() => handleViewModeChange('reviewer')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${viewMode === 'reviewer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>
              <User className="w-4 h-4" /> 评价活跃
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 过滤栏 */}
        <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-500">{viewMode === 'reviewer' ? '评价者' : '成员'}：</span>
            <UserFilterDropdown list={userList} selectedIds={selectedIds} onToggle={handleToggleItem} onToggleAll={handleToggleAll} label={viewMode === 'reviewer' ? '评价者' : '成员'} />
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-500">指标：</span>
            <Select value={viewMetric} onValueChange={(v) => setViewMetric(v as ViewMetric)}>
              <SelectTrigger className="h-8 px-3 text-sm border-slate-200 w-[110px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {metricOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-500">周期：</span>
            <MonthSelector selectedCycle={selectedCycle} onCycleChange={setSelectedCycle} showCurrentBadge={false} className="w-40" />
          </div>
          <div className="text-sm text-slate-400 ml-auto whitespace-nowrap">已选 {selectedIds.length} / {userList.length} 人</div>
        </div>

        {/* 图表卡片 */}
        <Card className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-lg font-bold text-slate-900">
                {viewMode === 'reviewer' ? viewMetric === 'count' ? '评价活跃度 - 评价数量' : '评价活跃度 - 平均分' : viewMetric === 'count' ? '成员得分趋势 - 收到评价数' : '成员得分趋势 - 平均分'}
              </CardTitle>
              <div className="ml-auto text-xs text-slate-400">单位：{viewMetric === 'count' ? '条数' : '分值'}</div>
            </div>
          </CardHeader>
          <CardContent className="p-6 h-[460px]">
            {loading ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">暂无数据</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis domain={viewMetric === 'count' ? [0, 'auto'] : [0, 5]} tickCount={viewMetric === 'count' ? undefined : 6} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }} labelStyle={{ fontWeight: 'bold' }} />
                  <Legend layout="horizontal" verticalAlign="top" align="center" wrapperStyle={{ paddingBottom: 8, fontSize: 11 }} iconType="circle" iconSize={7} />
                  {sortedSelectedIds.map((itemId, idx) => {
                    const user = userList.find(r => r.id === itemId);
                    if (!user) return null;
                    const color = colors[idx % colors.length];
                    return (
                      <Line key={itemId} type="monotone" dataKey={itemId} name={user.name} stroke={color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} />
                    );
                  })}
                  {viewMetric === 'score' && (
                    <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '3分基准', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 表格卡片 */}
        <TrendTable chartData={chartData} sortedIds={sortedSelectedIds} userList={userList} viewMetric={viewMetric} colors={colors} />
      </main>
    </div>
  );
}
