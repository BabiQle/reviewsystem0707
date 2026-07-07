// src/components/MonthSelector.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { pb } from '@/db/pb';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, TrendingUp } from 'lucide-react';
import { MonthCycle } from '@/types/types';

interface MonthSelectorProps {
  selectedCycle: string;
  onCycleChange: (cycleId: string) => void;
  showCurrentBadge?: boolean;
  className?: string;
}

const MonthSelector = ({ selectedCycle, onCycleChange, showCurrentBadge = true, className = '' }: MonthSelectorProps) => {
  const [cycles, setCycles] = useState<MonthCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const loadCycles = async () => {
      try {
        const result = await pb.collection('month_cycles').getList<MonthCycle>(1, 100, { sort: '-start_date' });
        const sorted = result.items;
        setCycles(sorted);
        // 首次加载时自动选中当前活跃周期
        const active = sorted.find((c) => c.is_active);
        if (active && !selectedCycle) {
          onCycleChange(active.id);
        }
      } catch (error) {
        console.error('加载月份失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCycles();
  }, [selectedCycle, onCycleChange]);

  const currentCycle = cycles.find((c) => c.is_active);
  const currentMonthName = currentCycle?.name;
  const selectedName = cycles.find((c) => c.id === selectedCycle)?.name;

  const handleSelect = useCallback(
    (cycleId: string) => {
      onCycleChange(cycleId);
      setOpen(false);
    },
    [onCycleChange],
  );

  const handleSelectCurrent = useCallback(() => {
    if (currentCycle) {
      onCycleChange(currentCycle.id);
      setOpen(false);
    }
  }, [currentCycle, onCycleChange]);

  const handleSelectRecent = useCallback(
    (months: number) => {
      const recent = cycles.slice(0, months);
      if (recent.length > 0) {
        onCycleChange(recent[0].id);
        setOpen(false);
      }
    },
    [cycles, onCycleChange],
  );

  const triggerContent = loading
    ? '加载中...'
    : currentCycle && selectedCycle === currentCycle.id && showCurrentBadge
      ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs px-1.5 py-0.5">当前</Badge>
            <span>{currentMonthName}</span>
          </div>
        )
      : selectedName || '选择月份';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`h-9 px-3 text-sm border border-slate-300 rounded-md bg-white text-left flex items-center gap-2 hover:bg-slate-50 transition-colors ${className}`}
          disabled={loading}
        >
          {triggerContent}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command className="h-96">
          <CommandInput placeholder="搜索月份..." />
          <CommandList className="overflow-y-auto max-h-72">
            {cycles.length === 0 ? (
              <CommandEmpty>暂无月份数据</CommandEmpty>
            ) : (
              <>
                <CommandGroup heading="快速选择">
                  {currentCycle && (
                    <CommandItem onSelect={handleSelectCurrent} className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-500" />
                      <span>当前月份 ({currentMonthName})</span>
                    </CommandItem>
                  )}
                  <CommandItem onSelect={() => handleSelectRecent(1)} className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                    <span>最近1个月</span>
                  </CommandItem>
                  <CommandItem onSelect={() => handleSelectRecent(3)} className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                    <span>最近3个月</span>
                  </CommandItem>
                  <CommandItem onSelect={() => handleSelectRecent(6)} className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                    <span>最近6个月</span>
                  </CommandItem>
                  <CommandItem onSelect={() => handleSelectRecent(12)} className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                    <span>最近1年</span>
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="所有月份">
                  {cycles.map((cycle) => (
                    <CommandItem
                      key={cycle.id}
                      onSelect={() => handleSelect(cycle.id)}
                      className={`flex items-center justify-between ${cycle.id === selectedCycle ? 'bg-indigo-50 text-indigo-700' : ''}`}
                    >
                      <span>{cycle.name}</span>
                      {cycle.is_active && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs px-1.5 py-0.5">当前</Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default MonthSelector;