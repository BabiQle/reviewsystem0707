import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { APP_VERSION_SHORT } from '@/App';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { pb } from '@/db/pb';
import { Menu, Users, LogOut, TrendingUp, ChevronDown, Star, Calendar, Lock, Sparkles, Inbox, BarChart3, Info } from 'lucide-react';
import { ROLE_LABELS } from '@/types/types';
import type { UserRole } from '@/types/types';

const APP_NAME = "团队互评平台";
const APP_VERSION = APP_VERSION_SHORT;
interface NavItem { path: string; label: string; icon: React.ReactNode; roles: UserRole[]; }

const NAV_ITEMS: NavItem[] = [
  { path: '/review', label: '填写评价', icon: <Sparkles className="w-4 h-4" />, roles: ['admin', 'reviewer'] },
  { path: '/my-reviews', label: '我的评价', icon: <Inbox className="w-4 h-4" />, roles: ['admin', 'reviewer', 'reviewee_only'] },
  { path: '/my-stats', label: '我的统计', icon: <BarChart3 className="w-4 h-4" />, roles: ['admin', 'reviewer', 'reviewee_only'] },
  { path: '/stats', label: '评价统计', icon: <BarChart3 className="w-4 h-4" />, roles: ['admin', 'reviewer'] },
  { path: '/admin/users', label: '用户管理', icon: <Users className="w-4 h-4" />, roles: ['admin'] },
  { path: '/admin/cycles', label: '评价周期', icon: <Calendar className="w-4 h-4" />, roles: ['admin'] },
  { path: '/trend', label: '趋势分析', icon: <TrendingUp className="w-4 h-4" />, roles: ['admin', 'reviewer', 'reviewee_only'] },
  { path: '/guide', label: '使用指南', icon: <Info className="w-4 h-4" />, roles: ['admin', 'reviewer', 'reviewee_only'] },
];

function useHasReviewed() {
  const { profile } = useAuth();
  const [state, setState] = useState({ hasReviewed: false, loading: true });

  const checkReview = useCallback(async () => {
    if (!profile) {
      setState({ hasReviewed: false, loading: false });
      return;
    }

    try {
      // 获取当前月份的开始和结束时间（使用更精确的时间处理）
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // 使用更精确的 PocketBase 查询
      const filter = `from_user = "${profile.id}" && created >= "${startOfMonth.toISOString()}" && created < "${endOfMonth.toISOString()}"`;
      const result = await pb.collection('reviews').getList(1, 1, {
        filter,
        sort: '-created'
      });

      setState({ hasReviewed: result.items.length > 0, loading: false });
    } catch (error) {
      console.error('检查评价状态失败:', error);
      setState({ hasReviewed: false, loading: false });
    }
  }, [profile]);

  useEffect(() => {
    checkReview();
  }, [checkReview]);

  // 优化事件监听器，确保正确清理
  useEffect(() => {
    const handleReviewSubmitted = () => checkReview();
    window.addEventListener('review-submitted', handleReviewSubmitted);

    return () => {
      window.removeEventListener('review-submitted', handleReviewSubmitted);
    };
  }, [checkReview]);

  return state;
}


const NavItems = memo(({ role, onClose }: { role: UserRole; onClose?: () => void }) => {
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const { hasReviewed, loading } = useHasReviewed();
  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {items.map((item) => {
        const showLabel = item.path === '/review' && (role === 'admin' || role === 'reviewer') && !loading && !hasReviewed;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors min-h-[44px]
              ${ isActive
                ? 'bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-900/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            {item.icon}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm truncate">{item.label}</span>
              {showLabel && (<Badge variant="destructive" className="text-[10px] leading-4 px-1.5 py-0 rounded-sm font-medium whitespace-nowrap shrink-0">未填写</Badge>)}
            </div>
          </NavLink>
        );
      })}
    </nav>
  );
});
NavItems.displayName = 'NavItems';

const ChangePasswordDialog = memo(({ open, onOpenChange, defaultUsername }: { open: boolean; onOpenChange: (open: boolean) => void; defaultUsername?: string; }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const username = defaultUsername || '';
  const resetForm = useCallback(() => { setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }, []);
  const handleClose = useCallback(() => { onOpenChange(false); resetForm(); }, [onOpenChange, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (!username.trim()) { toast.error('无法获取当前用户名，请重新登录'); return; }
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) { toast.error('请填写所有密码字段'); return; }
    if (newPassword !== confirmPassword) { toast.error('两次输入的新密码不一致'); return; }
    if (newPassword.length < 8) { toast.error('新密码长度不能少于8位字符'); return; }
    if (newPassword === oldPassword) { toast.error('新密码不能与当前密码相同'); return; }
    setLoading(true);
    try {
      const authData = await pb.collection('users').authWithPassword(username.trim(), oldPassword);
      // PocketBase 更新密码不需要传 oldPassword 字段
      await pb.collection('users').update(authData.record.id, { password: newPassword, passwordConfirm: confirmPassword });
      await pb.collection('users').authWithPassword(username.trim(), newPassword);
      toast.success('密码修改成功，页面将刷新！');
      handleClose();
      window.location.reload();
    } catch (err: any) {
      const errorData = err?.response?.data;
      if (errorData?.password) toast.error('新密码不符合规则，请设置至少8位字符');
      else if (err.message?.includes('Failed to authenticate')) toast.error('用户名或原密码错误');
      else toast.error(`修改密码失败：${err.message || '请重试'}`);
    } finally { setLoading(false); }
  }, [username, oldPassword, newPassword, confirmPassword, handleClose]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>修改登录密码</DialogTitle>
          <DialogDescription>请输入当前密码，并设置新的登录密码（至少8位）</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="oldPwd" className="text-right">原密码</Label>
            <Input id="oldPwd" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="col-span-3 border-slate-300" placeholder="请输入当前密码" disabled={loading} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newPwd" className="text-right">新密码</Label>
            <Input id="newPwd" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="col-span-3 border-slate-300" placeholder="请输入新密码（至少8位）" disabled={loading} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="confirmPwd" className="text-right">确认密码</Label>
            <Input id="confirmPwd" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="col-span-3 border-slate-300" placeholder="请再次输入新密码" disabled={loading} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>取消</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">{loading ? '提交中...' : '确认修改'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
ChangePasswordDialog.displayName = 'ChangePasswordDialog';

interface SidebarContentProps { role: UserRole; displayName: string; username: string; navigate: (path: string) => void; onClose: () => void; onSignOut: () => void; onOpenPwdDialog: () => void; }
const SidebarContent = memo(function SidebarContent({ role, displayName, navigate, onClose, onSignOut, onOpenPwdDialog }: SidebarContentProps) {
  const initial = useMemo(() => (displayName || '?')[0].toUpperCase(), [displayName]);
  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-800 select-none">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-indigo-900/50">
          <Star className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold tracking-tight text-white">{APP_NAME}</p>
          <p className="text-xs text-slate-500 tracking-tight mt-0.5">版本 {APP_VERSION}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <NavItems role={role} onClose={onClose} />
      </div>

      <div className="border-t border-slate-800 px-3 py-3">
        {!displayName ? (
          <Button variant="ghost" className="w-full justify-start gap-2 text-slate-400 hover:bg-slate-800 hover:text-white px-2" onClick={() => navigate("/login")}>
            <Lock className="w-4 h-4" /><span className="text-sm font-medium truncate">登录 / 注册</span>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 text-slate-400 hover:bg-slate-800 hover:text-white px-2">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">{initial}</div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate text-slate-200">{displayName}</p>
                </div>
                <ChevronDown className="w-3 h-3 shrink-0 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-slate-900">{displayName}</p>
                <Badge variant="secondary" className="text-xs mt-1 bg-slate-100 text-slate-600">{ROLE_LABELS[role]}</Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenPwdDialog} className="text-slate-700 hover:bg-slate-100">
                <Lock className="w-4 h-4 mr-2 text-slate-500" /> 修改密码
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="text-rose-600 focus:text-rose-600 hover:bg-rose-50">
                <LogOut className="w-4 h-4 mr-2" /> 退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
});
SidebarContent.displayName = 'SidebarContent';

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);

  const role = useMemo(() => (profile?.role ?? 'reviewee_only') as UserRole, [profile?.role]);
  const displayName = useMemo(() => profile?.display_name || profile?.username || '', [profile?.display_name, profile?.username]);
  const username = useMemo(() => profile?.username || '', [profile?.username]);

  const handleSignOut = useCallback(async () => { await signOut(); navigate('/login', { replace: true }); }, [signOut, navigate]);
  const handleCloseMobile = useCallback(() => setMobileOpen(false), []);
  const handleOpenPwdDialog = useCallback(() => setPwdDialogOpen(true), []);

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <aside className="hidden md:flex flex-col w-60 shrink-0 fixed top-0 left-0 h-screen z-30">
        <SidebarContent role={role} displayName={displayName} username={username} navigate={navigate} onClose={handleCloseMobile} onSignOut={handleSignOut} onOpenPwdDialog={handleOpenPwdDialog} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col md:ml-60">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-40 shadow-sm">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-slate-600">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-slate-900 border-r-0">
              <SidebarContent role={role} displayName={displayName} username={username} navigate={navigate} onClose={handleCloseMobile} onSignOut={handleSignOut} onOpenPwdDialog={handleOpenPwdDialog} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 flex-1 min-w-0 select-none">
            <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold truncate text-slate-800">{APP_NAME}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      <ChangePasswordDialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen} defaultUsername={username} />
    </div>
  );
}
