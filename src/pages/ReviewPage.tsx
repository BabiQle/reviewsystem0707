import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { pb } from '@/db/pb';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { MonthBadge } from '@/components/ui/month-badge';
import { Star, Send, CheckCircle2, Circle, Users, ArrowLeft, Sparkles, Target, AlertCircle, Info, Eye, EyeOff, Filter, Download, Lock, FileCheck } from 'lucide-react';
import { DIMENSION_LABELS, DIMENSIONS, Profile, UserRole, ReviewRecord, ReviewFormData, MonthCycle } from '@/types/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// ===== 应用级自定义事件常量（避免拼写错误，获得字面量类型推断）=====
export const REVIEW_EVENTS = {
  SUBMITTED: 'review-submitted',
  UNLOCK_STATUS_CHANGED: 'unlock-status-changed',
} as const;

// 解锁状态变更事件的 payload 类型
export interface UnlockStatusChangeDetail {
  userId: string;
  action: 'approved' | 'rejected';
  newState?: { completed: boolean; unlockRequested: boolean; unlockApproved: boolean; };
}

interface UserOption {
  id: string;
  username: string;
  display_name: string;
  pinyinFull: string;
  pinyinFirst: string;
}

interface SingleUserData {
  scores: Record<string, number>;
  notes: Record<string, string>;
  touched: Record<string, boolean>;
}

type ReviewData = Record<string, SingleUserData>;

const DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90天

const getDraftStorageKey = (profileId: string, cycleId: string) => `review_drafts_${profileId}_${cycleId}`;

interface DraftPayload { ts: number; drafts: ReviewData; }

const loadDraftsFromStorage = (profileId: string, cycleId: string): ReviewData => {
  try {
    const stored = localStorage.getItem(getDraftStorageKey(profileId, cycleId));
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && 'drafts' in parsed) {
      return (parsed as DraftPayload).drafts ?? {};
    }
    return parsed ?? {};
  } catch {
    return {};
  }
};

const saveDraftsToStorage = (profileId: string, cycleId: string, drafts: ReviewData) => {
  try {
    const payload: DraftPayload = { ts: Date.now(), drafts };
    localStorage.setItem(getDraftStorageKey(profileId, cycleId), JSON.stringify(payload));
  } catch { /* 忽略 quota 超限 */ }
};

const cleanupExpiredDrafts = (profileId: string) => {
  try {
    const prefix = `review_drafts_${profileId}_`;
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const ts = parsed?.ts;
        if (typeof ts === 'number' && now - ts > DRAFT_TTL_MS) {
          localStorage.removeItem(key);
        }
      } catch { /* 单条解析失败跳过 */ }
    }
  } catch { /* localStorage 不可用时静默 */ }
};

const getFilterStorageKey = (profileId: string, cycleId: string) => `review_filter_${profileId}_${cycleId}`;

const loadFilterFromStorage = (profileId: string, cycleId: string): Set<string> => {
  try {
    const stored = localStorage.getItem(getFilterStorageKey(profileId, cycleId));
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set<string>();
};

const saveFilterToStorage = (profileId: string, cycleId: string, ids: Set<string>) => {
  try {
    localStorage.setItem(getFilterStorageKey(profileId, cycleId), JSON.stringify([...ids]));
  } catch {}
};

const getPendingApprovalKey = (profileId: string, cycleId: string) => `review_pending_approval_${profileId}_${cycleId}`;

const setPendingApproval = (profileId: string, cycleId: string) => { try { localStorage.setItem(getPendingApprovalKey(profileId, cycleId), 'true'); } catch {} };

const clearPendingApproval = (profileId: string, cycleId: string) => { try { localStorage.removeItem(getPendingApprovalKey(profileId, cycleId)); } catch {} };

const hasPendingApproval = (profileId: string, cycleId: string): boolean => { try { return localStorage.getItem(getPendingApprovalKey(profileId, cycleId)) === 'true'; } catch {} return false; };

const DIMENSION_HELP: Record<string, { description: string; rules: Record<string, string> }> = {
  data_quality: { description: '数据质量是否符合要求，质量原因返工的次数。', rules: { '优秀': '质量接近完美，整体不需要改动', '良好': '标注符合要求，有个别需要修改的', '合格': '标注基本符合要求，质量有待提升', '较差': '反复修改多次，并且需要督促修改的' } },
  personal_efficiency: { description: '参考工作量，效率。', rules: { '优秀': '超过平均水平50%', '良好': '超过平均水平20%', '合格': '平均水平附近', '较差': '低于平均水平' } },
  work_compliance: { description: '是否配合不同的工作安排，分担更多的责任，任务切换等，且完成较好。', rules: { '优秀': '积极主动承担额外任务，完成出色', '良好': '配合安排，按时完成', '合格': '基本配合，需要督促', '较差': '不配合工作安排，影响项目进度' } },
  work_enthusiasm: { description: '积极提问手上分配到的任务可能出现的问题，包括如何标注、标注的方式、图片缺陷是否一致、图片是否能标注等其他不明确的疑问。', rules: { '优秀': '主动提问，积极沟通，带动团队学习氛围', '良好': '能够主动提问，沟通顺畅', '合格': '偶尔提问，基本能完成任务', '较差': '从不主动提问，问题堆积影响进度' } },
  other_help: { description: '1. 帮助提升效率，提高准确率等各种想法，建议等。\n2. 遇到问题是否主动第一时间向身边的小伙伴寻求帮助，或者寻求领导帮助解决问题。', rules: { '优秀': '对项目、团队有重大贡献', '良好': '对项目有正面促进作用', '合格': '无突出贡献，但未造成负面影响', '较差': '对项目有较大拖累，延误时间，影响整体质量' } }
};

const getRatingInfo = (score: number, touched: boolean = false) => {
  if (!touched) return { label: '请评分', range: '', color: 'bg-slate-200', textColor: 'text-slate-400', lightColor: 'bg-slate-50', borderColor: 'border-slate-200', progressColor: 'bg-slate-300' };
  if (score >= 4.5) return { label: '优秀', range: '4.5-5.0分', color: 'bg-rose-500', textColor: 'text-rose-600', lightColor: 'bg-rose-50', borderColor: 'border-rose-200', progressColor: 'bg-rose-500' };
  if (score >= 3.0) return { label: '良好', range: '3.0-4.0分', color: 'bg-indigo-500', textColor: 'text-indigo-600', lightColor: 'bg-indigo-50', borderColor: 'border-indigo-200', progressColor: 'bg-indigo-500' };
  if (score >= 1.5) return { label: '合格', range: '1.5-2.5分', color: 'bg-amber-500', textColor: 'text-amber-600', lightColor: 'bg-amber-50', borderColor: 'border-amber-200', progressColor: 'bg-amber-500' };
  return { label: '较差', range: '0-1.0分', color: 'bg-slate-300', textColor: 'text-slate-500', lightColor: 'bg-slate-50', borderColor: 'border-slate-200', progressColor: 'bg-slate-300' };
};

const isCurrentMonth = (cycle: MonthCycle) => {
  const now = new Date();
  const startDate = new Date(cycle.start_date || '');
  return startDate.getFullYear() === now.getFullYear() && startDate.getMonth() === now.getMonth();
};

const isValidDraftData = (data: SingleUserData) => DIMENSIONS.some(dim => data.touched[dim]) || DIMENSIONS.some(dim => data.notes[dim].trim() !== '');
const isAllDimensionTouched = (data: SingleUserData) => DIMENSIONS.every(dim => data.touched[dim]);
const getDefaultSingleUserData = (): SingleUserData => {
  const scores: Record<string, number> = {};
  const notes: Record<string, string> = {};
  const touched: Record<string, boolean> = {};
  DIMENSIONS.forEach(dim => { scores[dim] = 0; notes[dim] = ''; touched[dim] = false; });
  return { scores, notes, touched };
};

const DimensionHelpPopover = memo(function DimensionHelpPopover({ dimension, children }: { dimension: string; children: React.ReactNode; }) {
  const help = DIMENSION_HELP[dimension];
  if (!help) return <>{children}</>;
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 max-h-60 overflow-y-auto text-sm p-4" side="right" align="start">
        <div className="space-y-2">
          <p className="font-medium text-slate-900">{DIMENSION_LABELS[dimension as keyof typeof DIMENSION_LABELS]}</p>
          <p className="text-slate-600 whitespace-pre-line">{help.description}</p>
          <div className="border-t border-slate-100 pt-2 mt-2">
            <p className="text-xs font-medium text-slate-500 mb-1">评分参考</p>
            <ul className="space-y-1 text-xs">
              {Object.entries(help.rules).map(([key, value]) => (
                <li key={key} className="flex gap-2"><span className="font-medium text-slate-700 min-w-[40px]">{key}</span><span className="text-slate-600">{value}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});
DimensionHelpPopover.displayName = 'DimensionHelpPopover';

const StarRating = memo(function StarRating({ value, onChange, touched, disabled = false }: { value: number; onChange: (score: number) => void; touched: boolean; disabled?: boolean; }) {
  const isDraggingRef = useRef(false);
  const handleStarClick = useCallback((score: number) => { if (disabled) return; onChange(score); }, [onChange, disabled]);
  const handleMouseEnter = useCallback((score: number) => { if (disabled || !isDraggingRef.current) return; onChange(score); }, [onChange, disabled]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'w' || e.key === 'W') { e.preventDefault(); onChange(Math.min(5, value + 0.5)); }
    else if (e.key === 's' || e.key === 'S') { e.preventDefault(); onChange(Math.max(0, value - 0.5)); }
  }, [value, onChange, disabled]);

  if (disabled) {
    return (
      <div className="flex items-center gap-0.5 select-none">
        {[1, 2, 3, 4, 5].map(star => {
          const isFull = star <= Math.floor(value);
          const isHalf = star === Math.ceil(value) && value % 1 === 0.5;
          return (
            <div key={star} className="relative w-8 h-8">
              <Star className="h-8 w-8 text-slate-300" />
              {isFull && <Star className="h-8 w-8 fill-amber-400 text-amber-400 absolute top-0 left-0" />}
              {isHalf && (<div className="absolute top-0 left-0 overflow-hidden w-4 pointer-events-none"><Star className="h-8 w-8 fill-amber-400 text-amber-400" /></div>)}
            </div>
          );
        })}
        {touched && <span className="ml-3 text-base font-bold text-slate-900 tabular-nums">{value.toFixed(1)}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 select-none relative" onMouseDown={() => (isDraggingRef.current = true)} onMouseUp={() => (isDraggingRef.current = false)} onMouseLeave={() => (isDraggingRef.current = false)} onKeyDown={handleKeyDown} tabIndex={0}>
      <button type="button" onClick={() => handleStarClick(0)} onMouseEnter={() => handleMouseEnter(0)} className="absolute left-0 top-0 w-[12px] h-8 z-20 cursor-pointer focus:outline-none" title="点击清零" disabled={disabled} />
      {[1, 2, 3, 4, 5].map(star => {
        const isFull = star <= Math.floor(value);
        const isHalf = star === Math.ceil(value) && value % 1 === 0.5;
        return (
          <div key={star} className="relative w-8 h-8">
            <button type="button" onClick={() => handleStarClick(star - 0.5)} onMouseEnter={() => handleMouseEnter(star - 0.5)} className="absolute top-0 left-0 w-1/2 h-full overflow-hidden z-10 cursor-pointer hover:scale-110 transition-transform focus:outline-none" title={`${star - 0.5}分`} disabled={disabled}>
              <Star className="h-8 w-8 text-slate-300" />
              {(isFull || isHalf) && <Star className="h-8 w-8 fill-amber-400 text-amber-400 absolute top-0 left-0" />}
            </button>
            <button type="button" onClick={() => handleStarClick(star)} onMouseEnter={() => handleMouseEnter(star)} className="absolute top-0 left-1/2 w-1/2 h-full overflow-hidden z-10 cursor-pointer hover:scale-110 transition-transform focus:outline-none" title={`${star}分`} disabled={disabled}>
              <Star className="h-8 w-8 text-slate-300 -ml-4" />
              {isFull && <Star className="h-8 w-8 fill-amber-400 text-amber-400 absolute top-0 -ml-4" />}
            </button>
            <Star className="h-8 w-8 text-slate-300 absolute top-0 left-0 pointer-events-none" />
            {isFull && <Star className="h-8 w-8 fill-amber-400 text-amber-400 absolute top-0 left-0 pointer-events-none" />}
            {isHalf && (<div className="absolute top-0 left-0 overflow-hidden w-4 pointer-events-none"><Star className="h-8 w-8 fill-amber-400 text-amber-400" /></div>)}
          </div>
        );
      })}
      {value > 0 ? (<span className="ml-3 text-base font-bold text-slate-900 tabular-nums">{value.toFixed(1)}</span>) : touched ? (<span className="ml-3 text-base font-bold text-rose-500 tabular-nums">0.0</span>) : null}
    </div>
  );
});
StarRating.displayName = 'StarRating';

const RatingDisplay = memo(function RatingDisplay({ score, touched }: { score: number; touched: boolean }) {
  const info = getRatingInfo(score, touched);
  const percentage = (score / 5) * 100;
  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${touched ? info.textColor : 'text-slate-400'}`}>{touched ? `${info.label} ${info.range}` : '请评分'}</span>
        <span className={`font-medium ${touched ? info.textColor : 'text-slate-400'}`}>{touched ? score.toFixed(1) : '0.0'}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-300 rounded-full ${touched ? info.progressColor : 'bg-slate-300'}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
});
RatingDisplay.displayName = 'RatingDisplay';

const HelpContent = memo(function HelpContent({ dimension, score, touched }: { dimension: string; score: number; touched: boolean }) {
  const [visible, setVisible] = useState(true);
  const help = DIMENSION_HELP[dimension];
  if (!help) return null;
  const info = getRatingInfo(score, touched);
  const isRated = touched;
  const rule = isRated ? help.rules[info.label] : null;
  if (!visible) {
    return (
      <div className="mt-2 text-center">
        <button onClick={() => setVisible(true)} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1 mx-auto"><Eye className="h-3 w-3" /> 显示评分参考</button>
      </div>
    );
  }
  return (
    <div className={`mt-2 p-3 rounded-lg border ${isRated ? info.borderColor : 'border-slate-200'} ${isRated ? info.lightColor : 'bg-slate-50'} transition-all duration-200`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-xs text-slate-600 whitespace-pre-line">{help.description}</p>
          {isRated && rule && (<p className="text-xs font-medium mt-1 text-slate-700"><span className={`${info.textColor} font-bold`}>{info.label}</span>（{info.range}）：{rule}</p>)}
        </div>
        <button onClick={() => setVisible(false)} className="text-slate-400 hover:text-slate-600 ml-2 flex-shrink-0" title="隐藏参考"><EyeOff className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
});
HelpContent.displayName = 'HelpContent';

const FilterPopover = memo(function FilterPopover({ users, selectedIds, onToggle, onSelectAll, onClearAll, trigger, userStatusMap }: { users: UserOption[]; selectedIds: Set<string>; onToggle: (id: string) => void; onSelectAll: () => void; onClearAll: () => void; trigger: React.ReactNode; userStatusMap: Record<string, { label: string; color: string }>; }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-full min-w-[140px] p-2" align="start" side="bottom">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
          <span className="text-sm font-medium text-slate-600">筛选成员</span>
          <div className="flex gap-1">
            <button onClick={onSelectAll} className="text-sm text-indigo-500 hover:text-indigo-700 px-1.5 py-0.5 rounded hover:bg-indigo-50">全选</button>
            <button onClick={onClearAll} className="text-sm text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100">清空</button>
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {users.map(user => {
            const checked = selectedIds.has(user.id);
            const status = userStatusMap[user.id];
            return (
              <label key={user.id} className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-50 transition-colors text-sm ${checked ? 'bg-indigo-50' : ''}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <input type="checkbox" checked={checked} onChange={() => onToggle(user.id)} className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0" />
                  <span className="text-sm text-slate-700 select-none truncate">{user.display_name}</span>
                </div>
                {status && <span className={`text-sm font-medium shrink-0 ${status.color}`}>{status.label}</span>}
              </label>
            );
          })}
          {users.length === 0 && <p className="text-sm text-slate-400 text-center py-4">暂无成员</p>}
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-xs text-slate-400">
          <span>已选 {selectedIds.size} 人</span><span>共 {users.length} 人</span>
        </div>
      </PopoverContent>
    </Popover>
  );
});
FilterPopover.displayName = 'FilterPopover';

const UserListItem = memo(function UserListItem({ user, isCurrent, isCompleted, hasDraft, statusText, statusColor, onClick, disabled }: { user: UserOption; isCurrent: boolean; isCompleted: boolean; hasDraft: boolean; statusText: string; statusColor: string; onClick: () => void; disabled: boolean; }) {
  const itemClass = isCurrent ? 'bg-indigo-50 border-2 border-indigo-500 shadow-sm' : isCompleted ? 'bg-emerald-50 hover:bg-emerald-100 border border-slate-200' : hasDraft ? 'bg-rose-50 hover:bg-rose-100 border border-slate-200' : 'bg-white hover:bg-slate-100 border border-slate-200';
  return (
    <motion.button onClick={onClick} disabled={disabled} className={`w-full flex items-center gap-0.5 p-1.5 rounded-lg transition-all text-left ${itemClass} focus:outline-none`} whileHover={disabled ? {} : { scale: 1.02 }} whileTap={disabled ? {} : { scale: 0.98 }}>
      {isCompleted ? (<CheckCircle2 className={`h-3 w-3 ${isCurrent ? 'text-indigo-600' : 'text-emerald-600'} shrink-0`} />) : hasDraft ? (<AlertCircle className="h-3 w-3 text-rose-600 shrink-0" />) : (<Circle className={`h-3 w-3 ${isCurrent ? 'text-indigo-500' : 'text-slate-400'} shrink-0`} />)}
      <span className="font-medium text-sm text-slate-900 truncate flex-1">{user.display_name}</span>
      {statusText && <span className={`text-sm shrink-0 ${statusColor}`}>{statusText}</span>}
    </motion.button>
  );
});
UserListItem.displayName = 'UserListItem';

const DimensionCard = memo(function DimensionCard({ dim, score, touched, note, onScoreChange, onNoteChange, index, disabled = false }: { dim: string; score: number; touched: boolean; note: string; onScoreChange: (score: number) => void; onNoteChange: (note: string) => void; index: number; disabled?: boolean; }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <label className="text-base font-semibold text-slate-900 flex items-center gap-2 select-none cursor-default">
            <Target className="h-4 w-4 text-indigo-600" />
            {DIMENSION_LABELS[dim as keyof typeof DIMENSION_LABELS]}
            {!touched && <span className="text-xs text-rose-500">*未填写</span>}
          </label>
          <DimensionHelpPopover dimension={dim}>
            <button className="text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer focus:outline-none" type="button" disabled={disabled}><Info className="h-4 w-4" /></button>
          </DimensionHelpPopover>
        </div>
        <div className="flex items-center gap-1">
          {!disabled && <span className="text-[12px] font-mono font-medium text-slate-400 select-none cursor-default mr-1">W↑/S↓</span>}
          <StarRating value={score} onChange={onScoreChange} touched={touched} disabled={disabled} />
        </div>
      </div>
      <RatingDisplay score={score} touched={touched} />
      {touched && <HelpContent dimension={dim} score={score} touched={touched} />}
      <Textarea placeholder={disabled ? '只读模式' : '请输入评价说明（可选）'} value={note} onChange={(e) => onNoteChange(e.target.value)} className="min-h-[60px] border-slate-300 focus:border-indigo-400 resize-none text-sm focus:outline-none" disabled={disabled} />
    </motion.div>
  );
});
DimensionCard.displayName = 'DimensionCard';

export default function ReviewPage() {
  const { profile } = useAuth();
  const [cycles, setCycles] = useState<MonthCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [currentReviewUserId, setCurrentReviewUserId] = useState<string>('');
  const [completedUsers, setCompletedUsers] = useState<Set<string>>(new Set());
  const [allReviewData, setAllReviewData] = useState<ReviewData>({});
  const [draftCache, setDraftCache] = useState<ReviewData>({});
  const [filterSelectedIds, setFilterSelectedIds] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [cycleCompletion, setCycleCompletion] = useState<{ completed: boolean; unlockRequested: boolean; unlockApproved: boolean; } | null>(null);
  const [loadingCompletion, setLoadingCompletion] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const prevCycleCompletionRef = useRef<{ completed: boolean; unlockRequested: boolean; unlockApproved: boolean; } | null>(null);
  const submittingRef = useRef(false);
  const [submittingVersion, setSubmittingVersion] = useState(0);
  const submitting = submittingRef.current;
  const startSubmit = useCallback(() => { if (submittingRef.current) return false; submittingRef.current = true; setSubmittingVersion(v => v + 1); return true; }, []);
  const endSubmit = useCallback(() => { submittingRef.current = false; setSubmittingVersion(v => v + 1); }, []);
  const allReviewDataRef = useRef(allReviewData);
  allReviewDataRef.current = allReviewData;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const selectedCycleRef = useRef(selectedCycle);
  selectedCycleRef.current = selectedCycle;
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const lastSwitchTimeRef = useRef(0);
  const loadedUserRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (profile?.id) cleanupExpiredDrafts(profile.id);
  }, [profile?.id]);

  const loadCycleCompletion = useCallback(async () => {
    if (!profileRef.current || !selectedCycleRef.current) return;
    setLoadingCompletion(true);
    try {
      const result = await pb.collection('cycle_completions').getList(1, 1, { filter: `cycle_id="${selectedCycleRef.current}" && user_id="${profileRef.current.id}"`, sort: '-updated' });
      let newState: { completed: boolean; unlockRequested: boolean; unlockApproved: boolean; };
      if (result.items.length > 0) {
        const item = result.items[0] as any;
        newState = { completed: item.completed || false, unlockRequested: item.unlock_requested || false, unlockApproved: item.unlock_approved || false };
      } else {
        newState = { completed: false, unlockRequested: false, unlockApproved: false };
      }
      const prev = prevCycleCompletionRef.current;
      const pending = hasPendingApproval(profileRef.current.id, selectedCycleRef.current);
      const showApproved = (prev && prev.unlockApproved === false && newState.unlockApproved === true) || (!prev && pending && newState.unlockApproved === true && newState.unlockRequested === false);
      const showRejected = (prev && prev.unlockRequested === true && newState.unlockRequested === false && newState.unlockApproved === false) || (!prev && pending && newState.unlockRequested === false && newState.unlockApproved === false);
      if (showApproved) { toast.success('✅ 您的解锁申请已通过，可以继续修改评价', { duration: Infinity, action: { label: '关闭', onClick: () => toast.dismiss() } }); clearPendingApproval(profileRef.current.id, selectedCycleRef.current); }
      else if (showRejected) { toast.error('❌ 您的解锁申请已被驳回，如有疑问请联系管理员', { duration: Infinity, action: { label: '关闭', onClick: () => toast.dismiss() } }); clearPendingApproval(profileRef.current.id, selectedCycleRef.current); }
      prevCycleCompletionRef.current = newState;
      setCycleCompletion(newState);
    } catch (error) { console.error('加载周期完成状态失败:', error); toast.error('刷新状态失败，请检查网络'); } finally { setLoadingCompletion(false); }
  }, []);

  useEffect(() => {
    if (!selectedCycle || !profile) return;
    const interval = setInterval(() => { loadCycleCompletion(); }, 10000);
    return () => clearInterval(interval);
  }, [selectedCycle, profile, loadCycleCompletion]);

  useEffect(() => {
    const handleUnlockStatusChange = (event: Event) => {
      const detail = (event as CustomEvent<UnlockStatusChangeDetail>).detail;
      if (!detail || detail.userId !== profile?.id) return;
      if (detail.action === 'approved') {
        toast.success('✅ 您的解锁申请已通过，可以继续修改评价', { duration: Infinity, action: { label: '关闭', onClick: () => toast.dismiss() } });
        clearPendingApproval(profileRef.current!.id, selectedCycleRef.current);
      } else if (detail.action === 'rejected') {
        toast.error('❌ 您的解锁申请已被驳回，如有疑问请联系管理员', { duration: Infinity, action: { label: '关闭', onClick: () => toast.dismiss() } });
        clearPendingApproval(profileRef.current!.id, selectedCycleRef.current);
      }
      if (detail.newState) {
        prevCycleCompletionRef.current = detail.newState as any;
        setCycleCompletion(detail.newState as any);
      } else { loadCycleCompletion(); }
    };
    window.addEventListener(REVIEW_EVENTS.UNLOCK_STATUS_CHANGED, handleUnlockStatusChange as EventListener);
    return () => { window.removeEventListener(REVIEW_EVENTS.UNLOCK_STATUS_CHANGED, handleUnlockStatusChange as EventListener); };
  }, [profile, loadCycleCompletion]);

  useEffect(() => { prevCycleCompletionRef.current = null; setCycleCompletion(null); }, [selectedCycle]);
  useEffect(() => { if (selectedCycle && profile) { loadCycleCompletion(); } }, [selectedCycle, profile, loadCycleCompletion]);

  const loadCycles = useCallback(async () => {
    try {
      const result = await pb.collection('month_cycles').getList<MonthCycle>(1, 10, { sort: '-start_date', filter: 'is_active = true' });
      const cyclesData: MonthCycle[] = result.items.map((r) => ({ id: r.id, name: r.name ?? '', is_active: r.is_active ?? false, start_date: r.start_date ?? '' }));
      setCycles(cyclesData);
      setSelectedCycle(cyclesData.length > 0 ? cyclesData[0].id : 'default_cycle');
    } catch { toast.error('加载周期失败'); } finally { setLoadingCycles(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!profileRef.current || !selectedCycleRef.current) return;
    setLoadingUsers(true);
    try {
      const { pinyin } = await import('pinyin-pro');
      const result = await pb.collection('users').getList<Profile>(1, 200, { sort: 'display_name' });
      const filtered = result.items.filter((r) => r.id !== profileRef.current!.id);
      const usersData: UserOption[] = filtered.map((r) => {
        const displayName = r.display_name || r.username || '';
        return { id: r.id, username: r.username ?? '', display_name: displayName, pinyinFull: pinyin(displayName, { toneType: 'none', type: 'string' }).replace(/\s/g, ''), pinyinFirst: pinyin(displayName, { pattern: 'first', toneType: 'none' }).replace(/\s/g, '') };
      });
      setUsers(usersData);
      const initialData: ReviewData = {};
      usersData.forEach(u => { initialData[u.id] = getDefaultSingleUserData(); });
      setAllReviewData(initialData);
      setDraftCache({});
      setCompletedUsers(new Set());
      setHasChanges(false);

      const drafts = loadDraftsFromStorage(profileRef.current!.id, selectedCycleRef.current);
      setDraftCache(drafts);
      setAllReviewData(prev => {
        const next = { ...prev };
        Object.entries(drafts).forEach(([uid, data]) => {
          if (next[uid]) {
            DIMENSIONS.forEach(dim => {
              next[uid].scores[dim] = data.scores[dim];
              next[uid].notes[dim] = data.notes[dim];
              next[uid].touched[dim] = data.touched[dim];
            });
          }
        });
        return next;
      });

      const reviews = await pb.collection('reviews').getList<ReviewRecord>(1, 100, { filter: `cycle_id="${selectedCycleRef.current}"&&from_user="${profileRef.current!.id}"` });
      const completedSet = new Set<string>();
      const completedData: ReviewData = {};
      reviews.items.forEach((r) => {
        const uid = r.to_user;
        let content: ReviewFormData;
        try { content = typeof r.content === 'string' ? JSON.parse(r.content) : r.content; } catch { content = {} as ReviewFormData; }
        const data = getDefaultSingleUserData();
        DIMENSIONS.forEach(dim => { data.scores[dim] = content[dim]?.score ?? 0; data.notes[dim] = content[dim]?.note ?? ''; data.touched[dim] = true; });
        completedData[uid] = data;
        completedSet.add(uid);
      });
      setCompletedUsers(completedSet);
      setAllReviewData(prev => {
        const next = { ...prev };
        Object.entries(completedData).forEach(([uid, data]) => {
          if (!drafts[uid]) {
            next[uid] = data;
          }
        });
        return next;
      });
      completedSet.forEach(id => loadedUserRef.current.add(id));

      const savedFilter = loadFilterFromStorage(profileRef.current!.id, selectedCycleRef.current);
      const allIds = usersData.map(u => u.id);
      const validIds = new Set([...savedFilter].filter(id => allIds.includes(id)));
      setFilterSelectedIds(validIds.size > 0 ? validIds : new Set(allIds));
      if (usersData.length > 0) setCurrentReviewUserId(usersData[0].id);
    } catch { toast.error('加载成员列表失败'); } finally { setLoadingUsers(false); }
  }, []);

  const loadCompletedReviewsForUser = useCallback(async (userId: string) => {
    if (!userId || loadedUserRef.current.has(userId)) return;
    try {
      const result = await pb.collection('reviews').getList<ReviewRecord>(1, 1, { filter: `cycle_id="${selectedCycleRef.current}"&&from_user="${profileRef.current!.id}"&&to_user="${userId}"` });

      const storedDrafts = loadDraftsFromStorage(profileRef.current!.id, selectedCycleRef.current);
      if (storedDrafts[userId]) {
        loadedUserRef.current.add(userId);
        return;
      }

      if (result.items.length === 0) return;
      const review = result.items[0];
      let content: ReviewFormData;
      try { content = typeof review.content === 'string' ? JSON.parse(review.content) : review.content; } catch { content = {} as ReviewFormData; }
      const data = getDefaultSingleUserData();
      DIMENSIONS.forEach(dim => { data.scores[dim] = content[dim]?.score ?? 0; data.notes[dim] = content[dim]?.note ?? ''; data.touched[dim] = true; });
      loadedUserRef.current.add(userId);
      setAllReviewData(prev => ({ ...prev, [userId]: data }));
      setCompletedUsers(prev => new Set(prev).add(userId));
      setHasChanges(false);
    } catch {}
  }, []);

  useEffect(() => { if (profile) loadCycles(); }, [profile, loadCycles]);
  useEffect(() => { if (selectedCycle && profile) loadUsers(); }, [selectedCycle, profile, loadUsers]);
  useEffect(() => { loadedUserRef.current = new Set(); }, [selectedCycle]);
  useEffect(() => { if (currentReviewUserId && users.length > 0) loadCompletedReviewsForUser(currentReviewUserId); }, [currentReviewUserId, users, loadCompletedReviewsForUser]);

  const saveDraftToCache = useCallback((userId: string) => {
    const userData = allReviewDataRef.current[userId];
    if (!userData) return;
    const isValid = isValidDraftData(userData);
    setDraftCache(prev => {
      const next = { ...prev };
      if (isValid) next[userId] = { ...userData };
      else delete next[userId];
      if (profileRef.current && selectedCycleRef.current) { saveDraftsToStorage(profileRef.current.id, selectedCycleRef.current, next); }
      return next;
    });
    setHasChanges(false);
  }, []);

  const saveDraftImmediately = useCallback((userId: string) => {
    const userData = allReviewDataRef.current[userId];
    if (!userData || !isValidDraftData(userData)) return;
    try {
      const currentDrafts = loadDraftsFromStorage(profileRef.current!.id, selectedCycleRef.current);
      currentDrafts[userId] = { ...userData };
      saveDraftsToStorage(profileRef.current!.id, selectedCycleRef.current, currentDrafts);
      setDraftCache(currentDrafts);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentReviewUserId) {
        saveDraftImmediately(currentReviewUserId);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentReviewUserId, saveDraftImmediately]);

  useEffect(() => {
    if (!currentReviewUserId) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const userData = allReviewDataRef.current[currentReviewUserId];
      if (userData && isValidDraftData(userData)) {
         saveDraftToCache(currentReviewUserId);
      }
    }, 500);
    return () => clearTimeout(autoSaveTimerRef.current);
  }, [currentReviewUserId, allReviewData, saveDraftToCache]);

  const hasAnyData = useCallback((userId: string) => { const data = allReviewData[userId]; return data ? DIMENSIONS.some(dim => data.touched[dim]) : false; }, [allReviewData]);
  const getFilteredUsers = useMemo(() => users.filter(u => filterSelectedIds.has(u.id)), [users, filterSelectedIds]);

  useEffect(() => {
    if (getFilteredUsers.length === 0) { setCurrentReviewUserId(''); return; }
    if (!currentReviewUserId || !filterSelectedIds.has(currentReviewUserId)) { setCurrentReviewUserId(getFilteredUsers[0].id); }
  }, [filterSelectedIds, currentReviewUserId, getFilteredUsers]);

  const currentUser = useMemo(() => users.find(u => u.id === currentReviewUserId), [users, currentReviewUserId]);
  const getNextUser = useCallback(() => { const idx = getFilteredUsers.findIndex(u => u.id === currentReviewUserId); return idx === -1 ? null : getFilteredUsers[(idx + 1) % getFilteredUsers.length]; }, [getFilteredUsers, currentReviewUserId]);
  const getPrevUser = useCallback(() => { const idx = getFilteredUsers.findIndex(u => u.id === currentReviewUserId); return idx === -1 ? null : getFilteredUsers[(idx - 1 + getFilteredUsers.length) % getFilteredUsers.length]; }, [getFilteredUsers, currentReviewUserId]);

  const hasLocalDraft = useCallback((userId: string) => !!draftCache[userId], [draftCache]);

  const userStatusMap = useMemo(() => {
    const map: Record<string, { label: string; color: string }> = {};
    users.forEach(u => {
      if (completedUsers.has(u.id)) {
        map[u.id] = { label: '已完成', color: 'text-emerald-600' };
      } else if (hasAnyData(u.id)) {
        map[u.id] = { label: '未完成', color: 'text-indigo-700' };
      }
    });
    return map;
  }, [users, completedUsers, hasAnyData]);

  const submitReview = useCallback(async (userId: string) => {
    const userData = allReviewDataRef.current[userId];
    if (!userData) throw new Error('用户数据不存在');
    if (!isAllDimensionTouched(userData)) { toast.error('请完成所有维度评分（每个维度至少点击一次星星）'); throw new Error('未完成所有维度'); }
    const contentData: ReviewFormData = {} as ReviewFormData;
    DIMENSIONS.forEach(dim => { contentData[dim] = { score: userData.scores[dim], note: userData.notes[dim] }; });
    const targetUser = users.find(u => u.id === userId);
    const payload = { cycle_id: selectedCycleRef.current, from_user: profileRef.current!.id, to_user: userId, content: JSON.stringify(contentData), to_user_name: targetUser?.display_name || targetUser?.username || '' };
    const existing = await pb.collection('reviews').getList<ReviewRecord>(1, 1, { filter: `cycle_id="${selectedCycleRef.current}"&&from_user="${profileRef.current!.id}"&&to_user="${userId}"` });
    if (existing.items.length > 0) { await pb.collection('reviews').update(existing.items[0].id, payload); } else { await pb.collection('reviews').create(payload); }
    loadedUserRef.current.add(userId);
    setCompletedUsers(prev => new Set(prev).add(userId));
    setDraftCache(prev => { const next = { ...prev }; delete next[userId]; if (profileRef.current && selectedCycleRef.current) { saveDraftsToStorage(profileRef.current.id, selectedCycleRef.current, next); } return next; });
    setHasChanges(false);
    window.dispatchEvent(new Event(REVIEW_EVENTS.SUBMITTED));
    return true;
  }, [users]);

  const isCurrentUserCompleted = currentReviewUserId ? completedUsers.has(currentReviewUserId) : false;

  const preSwitchUserHandle = useCallback(async () => {
    if (!currentReviewUserId) return;
    const userData = allReviewDataRef.current[currentReviewUserId];
    if (!userData) return;

    if (!hasChanges) return;

    if (isAllDimensionTouched(userData)) {
      if (isCurrentUserCompleted) {
        saveDraftToCache(currentReviewUserId);
      } else {
        if (!startSubmit()) return;
        try { await submitReview(currentReviewUserId); } finally { endSubmit(); }
      }
    } else {
      saveDraftToCache(currentReviewUserId);
    }
  }, [currentReviewUserId, isCurrentUserCompleted, hasChanges, submitReview, saveDraftToCache, startSubmit, endSubmit]);

  const switchUser = useCallback(async (nextUserId: string) => {
    if (submittingRef.current) return;
    if (nextUserId === currentReviewUserId) return;
    try { await preSwitchUserHandle(); setCurrentReviewUserId(nextUserId); } catch { toast.error('自动提交失败，请手动提交后再切换'); }
  }, [preSwitchUserHandle, currentReviewUserId]);

  const handleSubmit = useCallback(async (saveAndNext: boolean = false) => {
    if (!currentReviewUserId) return;
    if (!startSubmit()) return;
    try {
      await submitReview(currentReviewUserId);
      if (saveAndNext) { const next = getNextUser(); if (next) await switchUser(next.id); else toast.success('🎉 已完成所有评价！'); }
    } catch (error: any) { const message = error?.response?.data?.message || error?.message || '提交失败，请检查网络或权限'; toast.error(`提交失败：${message}`); } finally { endSubmit(); }
  }, [currentReviewUserId, submitReview, getNextUser, switchUser, startSubmit, endSubmit]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (submittingRef.current) return;
      if (e.key.toLowerCase() !== 'a' && e.key.toLowerCase() !== 'd') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastSwitchTimeRef.current < 100) return;
      lastSwitchTimeRef.current = now;
      const next = e.key.toLowerCase() === 'd' ? getNextUser() : getPrevUser();
      if (next) switchUser(next.id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [getNextUser, getPrevUser, switchUser]);

  const handleScoreChange = useCallback((dim: string, newScore: number) => { if (!currentReviewUserId) return; setAllReviewData(prev => ({ ...prev, [currentReviewUserId]: { ...prev[currentReviewUserId], scores: { ...prev[currentReviewUserId].scores, [dim]: newScore }, touched: { ...prev[currentReviewUserId].touched, [dim]: true } } })); setHasChanges(true); }, [currentReviewUserId]);
  const handleNoteChange = useCallback((dim: string, newNote: string) => { if (!currentReviewUserId) return; setAllReviewData(prev => ({ ...prev, [currentReviewUserId]: { ...prev[currentReviewUserId], notes: { ...prev[currentReviewUserId].notes, [dim]: newNote } } })); setHasChanges(true); }, [currentReviewUserId]);
  const handleFilterToggle = useCallback((id: string) => { setFilterSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); saveFilterToStorage(profileRef.current!.id, selectedCycleRef.current, next); return next; }); }, []);
  const handleFilterSelectAll = useCallback(() => { const all = new Set(users.map(u => u.id)); setFilterSelectedIds(all); saveFilterToStorage(profileRef.current!.id, selectedCycleRef.current, all); }, [users]);
  const handleFilterClearAll = useCallback(() => { setFilterSelectedIds(new Set()); saveFilterToStorage(profileRef.current!.id, selectedCycleRef.current, new Set()); }, []);

  const exportMyReviews = useCallback(async () => {
    if (!profileRef.current || !selectedCycleRef.current) { toast.error('请先选择评价周期'); return; }
    if (profileRef.current.role !== 'admin' && profileRef.current.role !== 'reviewer') { toast.error('无导出权限'); return; }
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');
      const result = await pb.collection('reviews').getList<ReviewRecord>(1, 200, { filter: `cycle_id="${selectedCycleRef.current}"&&from_user="${profileRef.current.id}"`, sort: '-created' });
      if (result.items.length === 0) { toast.info('当前周期暂无您提交的评价'); return; }
      const toUserIds = new Set(result.items.map((r) => r.to_user));
      const usersMap = new Map<string, string>();
      if (toUserIds.size > 0) {
        const usersRes = await pb.collection('users').getList<Profile>(1, 200, { filter: Array.from(toUserIds).map(id => `id="${id}"`).join('||') });
        usersRes.items.forEach((u) => { usersMap.set(u.id, u.display_name || u.username || u.id); });
      }
      const workbook = new ExcelJS.Workbook();
      workbook.creator = '评价系统'; workbook.created = new Date();
      const fontName = '微软雅黑'; const fontSize = 11;
      const headerStyle = { font: { name: fontName, size: fontSize, bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }, alignment: { horizontal: 'center', vertical: 'middle' } };
      const centerStyle = { font: { name: fontName, size: fontSize }, alignment: { horizontal: 'center', vertical: 'middle' } };
      const remarkStyle = { font: { name: fontName, size: fontSize }, alignment: { horizontal: 'left', vertical: 'top', wrapText: true } };
      const headers = ['序号', '被评价人', ...DIMENSIONS.map(dim => DIMENSION_LABELS[dim]), '备注', '综合得分'];
      const rows: any[][] = [];
      result.items.forEach((review, idx: number) => {
        let content: ReviewFormData;
        try { content = typeof review.content === 'string' ? JSON.parse(review.content) : review.content; } catch { content = {} as ReviewFormData; }
        const toUserName = usersMap.get(review.to_user) || '未知';
        const dimScores = DIMENSIONS.map(dim => content[dim]?.score ?? 0);
        const richText: ExcelJS.RichText[] = [];
        let hasRemark = false;
        DIMENSIONS.forEach((dim) => {
          const note = content[dim]?.note?.trim();
          if (note) { hasRemark = true; if (richText.length > 0) { richText.push({ text: '\n', font: { name: fontName, size: fontSize } }); } richText.push({ text: `${DIMENSION_LABELS[dim]}：`, font: { name: fontName, size: fontSize, bold: true } }); richText.push({ text: `${note}；`, font: { name: fontName, size: fontSize } }); }
        });
        const remarkValue = hasRemark ? { richText } : '';
        const total = dimScores.reduce((sum, s) => sum + s, 0);
        const avg = DIMENSIONS.length > 0 ? total / DIMENSIONS.length : 0;
        rows.push([idx + 1, toUserName, ...dimScores, remarkValue, avg]);
      });
      const worksheet = workbook.addWorksheet('我的评价', { views: [{ state: 'frozen', ySplit: 1 }] });
      const headerRow = worksheet.addRow(headers); headerRow.height = 24; headerRow.eachCell((cell) => { cell.style = headerStyle; });
      const remarkColIndex = headers.indexOf('备注');
      rows.forEach((rowData) => { const row = worksheet.addRow([]); let rowHeight = 20; rowData.forEach((cellValue, colIndex) => { const cell = row.getCell(colIndex + 1); if (cellValue && typeof cellValue === 'object' && 'richText' in cellValue) { cell.value = { richText: cellValue.richText }; const text = cellValue.richText.map((part: any) => part.text).join(''); const lineCount = (text.match(/\n/g) || []).length + 1; rowHeight = Math.max(rowHeight, 20 + (lineCount - 1) * 14); cell.style = remarkStyle; } else { cell.value = cellValue; if (remarkColIndex !== -1 && colIndex === remarkColIndex) { cell.style = remarkStyle; } else { cell.style = centerStyle; } } if (typeof cell.value === 'number') { cell.numFmt = '0.00'; } }); row.height = rowHeight; });
      worksheet.columns.forEach((col, idx) => { const headerText = headers[idx] || ''; let maxLen = headerText.length; rows.forEach(rowData => { const val = String(rowData[idx] ?? ''); maxLen = Math.max(maxLen, val.length); }); if (idx === remarkColIndex) { col.width = Math.max(30, Math.min(maxLen + 2, 50)); } else { col.width = Math.min(Math.max(maxLen + 2, 10), 35); } });
      worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
      const now = new Date(); const dateStr = now.toISOString().slice(0, 10); const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const fileName = `我的评价_${dateStr}_${timeStr}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, fileName);
      toast.success(`导出成功，共 ${result.items.length} 条评价`);
    } catch (error) { console.error('导出失败:', error); toast.error('导出失败，请重试'); }
  }, []);

  const handleCompleteCycle = useCallback(async () => {
    if (!profileRef.current || !selectedCycleRef.current) return;
    const uncompletedCount = users.length - completedUsers.size;
    if (uncompletedCount > 0) { setShowCompleteConfirm(true); return; }
    await doCompleteCycle();
  }, [users, completedUsers]);

  const doCompleteCycle = useCallback(async () => {
    if (!profileRef.current || !selectedCycleRef.current) return;
    try {
      const res = await pb.collection('cycle_completions').getList(1, 1, { filter: `cycle_id="${selectedCycleRef.current}" && user_id="${profileRef.current.id}"`, sort: '-updated' });
      if (res.items.length > 0) { await pb.collection('cycle_completions').update(res.items[0].id, { completed: true, completed_at: new Date().toISOString(), unlock_requested: false, unlock_approved: false }); }
      else { await pb.collection('cycle_completions').create({ cycle_id: selectedCycleRef.current, user_id: profileRef.current!.id, completed: true, completed_at: new Date().toISOString() }); }
      clearPendingApproval(profileRef.current.id, selectedCycleRef.current);
      toast.success('🎉 本月标注已完成！');
      await loadCycleCompletion();
    } catch (error) { console.error('完成标注失败:', error); toast.error('完成标注失败，请重试'); }
  }, [loadCycleCompletion]);

  const handleRequestUnlock = useCallback(async () => {
    if (!profileRef.current || !selectedCycleRef.current || !cycleCompletion) return;
    if (cycleCompletion.unlockRequested) { toast.info('已提交解锁申请，请等待审核'); return; }
    try {
      const result = await pb.collection('cycle_completions').getList(1, 1, { filter: `cycle_id="${selectedCycleRef.current}" && user_id="${profileRef.current.id}"`, sort: '-updated' });
      if (result.items.length > 0) { await pb.collection('cycle_completions').update(result.items[0].id, { unlock_requested: true }); }
      else { await pb.collection('cycle_completions').create({ cycle_id: selectedCycleRef.current, user_id: profileRef.current!.id, completed: true, completed_at: new Date().toISOString(), unlock_requested: true }); }
      setPendingApproval(profileRef.current.id, selectedCycleRef.current);
      toast.success('已提交解锁申请，请等待超级管理员审核');
      await loadCycleCompletion();
    } catch (error: any) {
      console.error('申请解锁失败:', error);
      if (error.status === 404) {
        try { await pb.collection('cycle_completions').create({ cycle_id: selectedCycleRef.current, user_id: profileRef.current!.id, completed: true, completed_at: new Date().toISOString(), unlock_requested: true }); setPendingApproval(profileRef.current.id, selectedCycleRef.current); toast.success('已提交解锁申请，请等待超级管理员审核'); await loadCycleCompletion(); }
        catch (createError) { console.error('创建记录失败:', createError); toast.error('申请失败，请重试或联系管理员'); }
      } else { toast.error('申请失败，请重试'); }
    }
  }, [cycleCompletion, loadCycleCompletion]);

  const isReadOnly = cycleCompletion?.completed && !cycleCompletion?.unlockApproved;

  if (!profile) return <div className="flex items-center justify-center h-64"><p>请先登录</p></div>;

  const progress = (() => { const total = users.length; const completed = completedUsers.size; return { total, completed, percentage: total ? (completed / total) * 100 : 0 }; })();
  const currentUserHasDraft = currentReviewUserId ? !!draftCache[currentReviewUserId] : false;
  const isButtonDisabled = submitting || (isCurrentUserCompleted && !currentUserHasDraft && !hasChanges) || isReadOnly;
  const buttonText = submitting ? '提交中...' : (isCurrentUserCompleted && !currentUserHasDraft && !hasChanges) ? '已提交' : '提交';

  const currentUserData = currentUser ? allReviewData[currentUser.id] : null;
  const showExport = profile.role === 'admin' || profile.role === 'reviewer';

  return (
    <div className="flex flex-col h-screen bg-slate-50 select-none outline-none">
      <style>{`*:focus:not(:focus-visible){outline:none!important}*:focus-visible{outline:2px solid #4f46e5;outline-offset:2px}`}</style>
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm"><Sparkles className="h-5 w-5 text-white" /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">填写评价</h1>
              <motion.p className="text-xs text-slate-500" animate={{ opacity: [1, 0.15, 1], color: ['#64748b', '#4f46e5', '#64748b'], x: [0, -2, 2, -2, 2, 0] }} transition={{ duration: 0.8, repeat: 4, repeatType: 'loop', ease: 'easeInOut' }}>A/D切换 · 草稿自动保存</motion.p>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden md:block" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">评价周期</span>
            {loadingCycles ? (<Skeleton className="h-9 w-36" />) : (
              <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="选择月份" /></SelectTrigger>
                <SelectContent>{cycles.map(c => (<SelectItem key={c.id} value={c.id}>{c.name} {isCurrentMonth(c) && <MonthBadge />}</SelectItem>))}</SelectContent>
              </Select>
            )}
          </div>
          <div className="h-6 w-px bg-slate-200 hidden md:block" />
          {showExport && (
            <>
              <Button variant="outline" size="sm" onClick={exportMyReviews} className="gap-2 border-slate-300 h-9 text-sm"><Download className="h-4 w-4" /> 导出我的评价</Button>
              <div className="h-6 w-px bg-slate-200 hidden md:block" />
            </>
          )}
          <div className="flex items-center gap-3">
            {loadingCompletion ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <>
                {isReadOnly ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border h-9 px-3 text-xs leading-4 font-medium bg-emerald-100 text-emerald-700 border-emerald-200"><FileCheck className="h-3.5 w-3.5 shrink-0" /><span>已完成标注</span></span>
                    {cycleCompletion?.completed && !cycleCompletion?.unlockRequested && !cycleCompletion?.unlockApproved && (
                      <Button variant="outline" size="sm" onClick={handleRequestUnlock} className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 h-8 text-xs"><Lock className="h-3.5 w-3.5" /> 申请修改</Button>
                    )}
                    {cycleCompletion?.unlockRequested && !cycleCompletion?.unlockApproved && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border h-9 px-3 text-xs leading-4 font-medium bg-indigo-50 text-indigo-700 border-indigo-300"><AlertCircle className="h-3.5 w-3.5 shrink-0" /><span>已申请解锁</span></span>
                    )}
                  </div>
                ) : (
                  <Button variant="default" size="sm" onClick={handleCompleteCycle} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm"><CheckCircle2 className="h-4 w-4" /> 完成本月标注</Button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">正在评价</span>
              <span className="text-sm font-semibold text-slate-900 w-32 truncate" title={currentUser?.display_name}>
                {currentUser?.display_name || '-'} {isCurrentUserCompleted && (<span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0 text-[10px] leading-4 font-medium text-emerald-700">已提交</span>)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-28"><Progress value={progress.percentage} className="h-2" /></div>
              <span className="text-sm font-bold text-slate-900 tabular-nums">{progress.completed}/{progress.total}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-5">
        <div className="flex gap-5 h-full">
          <div className="w-[160px] shrink-0 h-full">
            <Card className="border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="bg-white border-b border-slate-200 p-1.5 shrink-0">
                <FilterPopover users={users} selectedIds={filterSelectedIds} onToggle={handleFilterToggle} onSelectAll={handleFilterSelectAll} onClearAll={handleFilterClearAll} userStatusMap={userStatusMap} trigger={
                  <Button size="sm" className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 rounded-lg min-w-[110px]"><Filter className="h-3.5 w-3.5" /> 筛选 <span className="ml-1 text-[9px] font-bold bg-white text-indigo-600 rounded-full px-1.5 h-4 inline-flex items-center justify-center">{filterSelectedIds.size}</span></Button>
                } />
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 bg-slate-50">
                {loadingUsers ? (
                  <div className="space-y-1">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded" />)}</div>
                ) : getFilteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center"><Users className="h-8 w-8 text-slate-300 mb-2" /><p className="text-sm text-slate-500">{users.length === 0 ? '暂无成员数据' : '没有匹配的成员'}</p></div>
                ) : (
                  <div className="space-y-0.5">
                    {getFilteredUsers.map(user => (
                      <UserListItem
                        key={user.id}
                        user={user}
                        isCurrent={user.id === currentReviewUserId}
                        isCompleted={completedUsers.has(user.id)}
                        hasDraft={hasLocalDraft(user.id)}
                        statusText={userStatusMap[user.id]?.label || ''}
                        statusColor={userStatusMap[user.id]?.color || ''}
                        onClick={() => switchUser(user.id)}
                        disabled={submitting}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
          <div className="flex-1 min-h-0">
            <Card className="border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50">
                {!currentUser || !currentUserData ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-500"><Users className="h-12 w-12 text-slate-300 mb-3" /><span>{users.length === 0 ? '暂无成员数据' : '请从左侧选择要评价的成员'}</span></div>
                ) : (
                  <div className="space-y-4">
                    {DIMENSIONS.map((dim, idx) => (
                      <DimensionCard key={dim} dim={dim} score={currentUserData.scores[dim]} touched={currentUserData.touched[dim]} note={currentUserData.notes[dim]} onScoreChange={(val) => handleScoreChange(dim, val)} onNoteChange={(val) => handleNoteChange(dim, val)} index={idx} disabled={isReadOnly} />
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-200 p-4 bg-white shrink-0">
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => { const prev = getPrevUser(); if (prev) switchUser(prev.id); }} disabled={getFilteredUsers.length <= 1 || submitting}><ArrowLeft className="h-4 w-4" /> 上一位</Button>
                  <AnimatePresence mode="wait">
                    {submitting ? (
                      <Button key="submitting" disabled className="gap-2 h-9 bg-indigo-600 text-white cursor-wait"><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 提交中...</Button>
                    ) : (
                      <motion.button key="submit" onClick={() => handleSubmit(true)} disabled={isButtonDisabled} className={`inline-flex items-center gap-2 px-4 py-2 h-9 text-sm rounded-md font-medium shadow-md transition-colors ${isButtonDisabled ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                        <Send className="h-4 w-4" />
                        <motion.span key={buttonText} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.25 }}>{buttonText}</motion.span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认完成标注</AlertDialogTitle>
            <AlertDialogDescription>您还有 {users.length - completedUsers.size} 位成员的评价未提交，确定要强制完成本月标注吗？完成后如需修改，需向超级管理员提交解锁申请。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowCompleteConfirm(false); doCompleteCycle(); }}>确认完成</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
