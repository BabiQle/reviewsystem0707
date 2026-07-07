import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { pb } from '@/db/pb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { MonthBadge } from '@/components/ui/month-badge';
import { Calendar, Clock, Info, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MonthCycle { id: string; name: string; is_active: boolean; start_date: string; end_date: string; }

const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
const isCurrentMonth = (cycle: MonthCycle) => {
  const now = new Date();
  const startDate = new Date(cycle.start_date || '');
  return startDate.getFullYear() === now.getFullYear() && startDate.getMonth() === now.getMonth();
};

const CycleInfoCard = memo(() => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 select-none">
    <div className="flex items-start gap-3">
      <div className="p-2 bg-indigo-100 rounded-lg shrink-0"><Info className="h-5 w-5 text-indigo-600" /></div>
      <div className="flex-1">
        <h3 className="font-bold text-slate-900 mb-2">周期管理说明</h3>
        <ul className="space-y-1.5 text-sm text-slate-700">
          <li className="flex items-start gap-2"><span className="text-indigo-500 mt-1">•</span><span>周期按自然月自动划分，每月 1 日至月底。</span></li>
          <li className="flex items-start gap-2"><span className="text-indigo-500 mt-1">•</span><span>系统会在管理员首次访问时自动创建下个月的评价周期，无需手动操作。</span></li>
          <li className="flex items-start gap-2"><span className="text-indigo-500 mt-1">•</span><span>当月周期默认开启；历史月份默认关闭，可手动开启补填。</span></li>
          <li className="flex items-start gap-2"><span className="text-indigo-500 mt-1">•</span><span>关闭后成员无法在该月填写新评价，已有数据不受影响。</span></li>
        </ul>
      </div>
    </div>
  </motion.div>
));
CycleInfoCard.displayName = 'CycleInfoCard';

const CycleCard = memo(function CycleCard({ cycle, updating, onToggle, index }: { cycle: MonthCycle; updating: boolean; onToggle: (id: string) => void; index: number; }) {
  const isCurrent = isCurrentMonth(cycle);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: index * 0.05 }} whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' }} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm transition-all select-none cursor-default">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-sm shrink-0 ${isCurrent ? 'bg-gradient-to-br from-emerald-400 to-emerald-500' : 'bg-gradient-to-br from-slate-300 to-slate-400'}`}>
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-slate-900 truncate">{cycle.name}</h3>
              {isCurrent && <MonthBadge size="md" />}
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500 overflow-hidden whitespace-nowrap">
              <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 shrink-0" /><span>{formatDate(cycle.start_date)}</span></div>
              <span className="shrink-0">至</span>
              <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 shrink-0" /><span>{formatDate(cycle.end_date)}</span></div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            {cycle.is_active ? (<Badge className="bg-emerald-500 text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> 已开启</Badge>) : (<Badge variant="outline" className="border-slate-300 text-slate-600"><XCircle className="h-3 w-3 mr-1" /> 已关闭</Badge>)}
          </div>
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="flex items-center gap-2">
              <Switch checked={cycle.is_active} onCheckedChange={() => onToggle(cycle.id)} disabled={updating} className="data-[state=checked]:bg-indigo-600" />
              <span className="text-sm text-slate-600 w-8">{cycle.is_active ? '开启' : '关闭'}</span>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default function CycleManagementPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [cycles, setCycles] = useState<MonthCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const cyclesRef = useRef(cycles); cyclesRef.current = cycles;
  const updatingIdRef = useRef(updatingId); updatingIdRef.current = updatingId;
  const autoCreatedRef = useRef(false);

  const loadCycles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await pb.collection('month_cycles').getList(1, 50, { sort: '-start_date' });
      const cyclesData: MonthCycle[] = result.items.map((r: any) => ({ id: r.id, name: r.name ?? '', is_active: r.is_active ?? false, start_date: r.start_date ?? '', end_date: r.end_date ?? '' }));
      setCycles(cyclesData);
      return cyclesData;
    } catch { toast.error('加载评价周期失败，请刷新重试'); return []; } finally { setLoading(false); }
  }, []);

  const autoCreateMissingCycles = useCallback(async (currentCycles: MonthCycle[]) => {
    if (!isAdmin || autoCreatedRef.current) return;
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const year = targetDate.getFullYear(); const month = targetDate.getMonth() + 1;
    const cycleName = `${year}年${month}月`;
    if (currentCycles.some(c => c.name === cycleName)) { autoCreatedRef.current = true; return; }
    try {
      const startDate = new Date(year, month - 1, 1); const endDate = new Date(year, month, 0);
      const isActive = year === now.getFullYear() && month === now.getMonth() + 1;
      await pb.collection('month_cycles').create({ name: cycleName, start_date: startDate.toISOString(), end_date: endDate.toISOString(), is_active: isActive });
      toast.success(`已自动创建 ${cycleName} 评价周期`, { duration: 3000 });
      autoCreatedRef.current = true;
      await loadCycles();
    } catch (error) { console.error('自动创建周期失败:', error); }
  }, [isAdmin, loadCycles]);

  useEffect(() => { const init = async () => { const data = await loadCycles(); if (data.length > 0) { await autoCreateMissingCycles(data); } }; init(); }, []);

  const toggleCycle = useCallback((cycleId: string) => {
    const currentCycles = cyclesRef.current; const currentUpdatingId = updatingIdRef.current;
    const cycle = currentCycles.find(c => c.id === cycleId);
    if (!cycle || currentUpdatingId === cycleId) return;
    const newActiveState = !cycle.is_active;
    setUpdatingId(cycleId);
    setCycles(prev => prev.map(c => (c.id === cycleId ? { ...c, is_active: newActiveState } : c)));
    pb.collection('month_cycles').update(cycleId, { is_active: newActiveState })
      .then(() => { toast.success(newActiveState ? '周期已开启' : '周期已关闭'); })
      .catch(() => { setCycles(currentCycles); toast.error('操作失败，请重试'); })
      .finally(() => { setUpdatingId(null); });
  }, []);

  if (!isAdmin) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">仅管理员可访问此页面</p></div>;

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm"><Calendar className="h-5 w-5 text-white" /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">评价周期 <Badge variant="outline" className="text-xs font-normal text-slate-500 border-slate-300 bg-slate-50">管理员</Badge></h1>
              <p className="text-xs text-slate-500">管理评价周期的开启和关闭，系统将自动创建下个月份</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <CycleInfoCard />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-bold text-slate-900">评价周期列表</h2></div>
          <Badge variant="secondary" className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700">共 {cycles.length} 个周期</Badge>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : cycles.length === 0 ? (
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="text-center text-slate-500 py-16">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>暂无评价周期数据</p><p className="text-sm text-slate-400 mt-2">请稍后刷新，系统将自动创建</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {cycles.map((cycle, index) => (<CycleCard key={cycle.id} cycle={cycle} updating={updatingId === cycle.id} onToggle={toggleCycle} index={index} />))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
