import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { pb } from '@/db/pb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Users, Shield, User, Eye, Plus, Trash2, Edit, Search, Lock, CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import * as XLSX from 'xlsx';
import type { Profile, UserRole } from '@/types/types';
import { motion, AnimatePresence } from 'framer-motion';

type UserFormData = {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
  display_name: string;
  role: UserRole;
};

const ROLE_CONFIG: Record<UserRole, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: '管理员', icon: Shield, color: 'bg-rose-100 text-rose-700 border-rose-200' },
  reviewer: { label: '评审人', icon: User, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  reviewee_only: { label: '组员', icon: Eye, color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const parseExcelFile = (file: File): { data: UserFormData[]; errors: string[] } => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
        const parsedUsers: UserFormData[] = [];
        const errors: string[] = [];
        jsonData.forEach((row: any, index: number) => {
          if (!row['用户名'] && !row['显示名称'] && !row['邮箱']) return;
          if (!row['用户名'] || !row['邮箱'] || !row['密码']) {
            errors.push(`第${index + 2}行：缺少必填字段（用户名/邮箱/密码）`);
            return;
          }
          if (row['密码'] !== row['确认密码']) {
            errors.push(`第${index + 2}行：两次输入的密码不一致`);
            return;
          }
          if (row['密码'].length < 6) {
            errors.push(`第${index + 2}行：密码长度不能少于6位`);
            return;
          }
          let role: UserRole = 'reviewee_only';
          if (row['角色'] == 1 || row['角色'] == '1') role = 'admin';
          else if (row['角色'] == 2 || row['角色'] == '2') role = 'reviewer';
          parsedUsers.push({
            username: String(row['用户名']).trim(),
            display_name: String(row['显示名称'] || row['用户名']).trim(),
            email: String(row['邮箱']).trim(),
            password: String(row['密码']).trim(),
            passwordConfirm: String(row['确认密码']).trim(),
            role
          });
        });
        resolve({ data: parsedUsers, errors });
      } catch (err) {
        resolve({ data: [], errors: ['解析Excel文件失败，请检查文件格式'] });
      }
    };
    reader.onerror = () => resolve({ data: [], errors: ['读取文件失败'] });
    reader.readAsBinaryString(file);
  });
};

const StatCard = memo(({ title, value, icon: Icon, colorClass }: { title: string; value: number; icon: any; colorClass?: string; }) => (
  <Card className="border border-slate-200 shadow-sm bg-white">
    <CardContent className="p-4 flex items-center justify-between">
      <div><p className="text-xs text-slate-500 font-medium">{title}</p><p className="text-2xl font-bold text-slate-900">{value}</p></div>
      <Icon className={`h-8 w-8 ${colorClass || 'text-slate-400'}`} />
    </CardContent>
  </Card>
));
StatCard.displayName = 'StatCard';

const RoleBadge = memo(({ role }: { role: UserRole }) => {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  return (<Badge variant="secondary" className={`${config.color} gap-1 px-2 py-0.5 text-xs font-normal flex-shrink-0`}><Icon className="h-3 w-3" />{config.label}</Badge>);
});
RoleBadge.displayName = 'RoleBadge';

const UserListItem = memo(({ user, index, onEdit, onDelete }: { user: Profile; index: number; onEdit: (user: Profile) => void; onDelete: (user: Profile) => void; }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="px-4 py-3 hover:bg-slate-50 transition-colors group">
    <div className="hidden md:grid grid-cols-[40px_48px_1fr_100px_80px] items-center gap-3">
      <div className="text-sm text-slate-500 text-center font-mono">{index + 1}</div>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">{user.display_name.charAt(0).toUpperCase()}</div>
      <div className="min-w-0"><p className="font-medium text-slate-900 truncate">{user.display_name}</p><p className="text-xs text-slate-500 truncate">@{user.username}</p></div>
      <div><RoleBadge role={user.role as UserRole} /></div>
      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="ghost" onClick={() => onEdit(user)} className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"><Edit className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(user)} className="h-8 w-8 p-0 text-slate-500 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
    <div className="md:hidden bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">{user.display_name.charAt(0).toUpperCase()}</div>
          <div><div className="font-semibold text-slate-900">{user.display_name}</div><div className="text-xs text-slate-500">@{user.username}</div></div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => onEdit(user)} className="h-8 w-8 p-0 text-slate-500"><Edit className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(user)} className="h-8 w-8 p-0 text-slate-500"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between"><RoleBadge role={user.role as UserRole} /><span className="text-xs text-slate-400">#{index + 1}</span></div>
    </div>
  </motion.div>
));
UserListItem.displayName = 'UserListItem';

const UserFormDialog = memo(({ isOpen, onClose, mode, initialData, onSubmit, loading }: { isOpen: boolean; onClose: () => void; mode: 'add' | 'edit'; initialData?: Profile; onSubmit: (data: UserFormData) => void; loading: boolean; }) => {
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    display_name: '',
    role: 'reviewee_only'
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        username: initialData?.username || '',
        email: initialData?.email || '',
        password: '',
        passwordConfirm: '',
        display_name: initialData?.display_name || '',
        role: (initialData?.role as UserRole) || 'reviewee_only'
      });
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'add') {
      if (!formData.username || !formData.email || !formData.password) {
        toast.error('请填写所有必填项');
        return;
      }
      if (formData.password !== formData.passwordConfirm) {
        toast.error('两次输入的密码不一致');
        return;
      }
      if (formData.password.length < 6) {
        toast.error('密码长度不能少于6位');
        return;
      }
    }
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{mode === 'add' ? '添加新用户' : '编辑用户信息'}</DialogTitle>
          <DialogDescription>{mode === 'add' ? '填写以下信息以创建新用户账户' : '修改用户的基本信息和权限'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>用户名</Label><Input value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} disabled={mode === 'edit'} placeholder="zhang.san" className="border-slate-300" /></div>
              <div className="space-y-2"><Label>显示名称</Label><Input value={formData.display_name} onChange={e => setFormData({ ...formData, display_name: e.target.value })} placeholder="张三" className="border-slate-300" /></div>
            </div>
            <div className="space-y-2"><Label>邮箱</Label><Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="zhang.san@example.com" className="border-slate-300" /></div>
            {mode === 'add' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>密码</Label><Input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="至少6位" className="border-slate-300" /></div>
                <div className="space-y-2"><Label>确认密码</Label><Input type="password" value={formData.passwordConfirm} onChange={e => setFormData({ ...formData, passwordConfirm: e.target.value })} placeholder="再次输入" className="border-slate-300" /></div>
              </div>
            )}
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={formData.role} onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}>
                <SelectTrigger className="border-slate-300"><SelectValue placeholder="选择角色" /></SelectTrigger>
                <SelectContent><SelectItem value="admin">管理员</SelectItem><SelectItem value="reviewer">评审人</SelectItem><SelectItem value="reviewee_only">组员</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">{loading ? '处理中...' : mode === 'add' ? '添加用户' : '保存修改'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
UserFormDialog.displayName = 'UserFormDialog';

const ImportDialog = memo(({ isOpen, onClose, onImport }: { isOpen: boolean; onClose: () => void; onImport: (data: UserFormData[]) => void; }) => {
  const [importData, setImportData] = useState<UserFormData[]>([]);
  const [importing, setImporting] = useState(false);
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data, errors } = await parseExcelFile(file);
    if (errors.length > 0) {
      toast.error(`数据验证失败：\n${errors.join('\n')}`);
      return;
    }
    if (data.length === 0) {
      toast.error('Excel文件中没有有效数据');
      return;
    }
    setImportData(data);
    toast.success(`成功解析 ${data.length} 条用户数据`);
    e.target.value = '';
  };
  const handleConfirmImport = async () => {
    setImporting(true);
    let successCount = 0, failCount = 0;
    for (const user of importData) {
      try {
        await pb.collection('users').create(user);
        successCount++;
      } catch {
        failCount++;
      }
    }
    toast.success(`导入完成！成功 ${successCount} 个，失败 ${failCount} 个`);
    onClose();
    setImportData([]);
    setImporting(false);
  };
  const downloadTemplate = () => {
    const template = [
      { '用户名': 'zhang.san', '显示名称': '张三', '邮箱': 'zhang.san@example.com', '密码': '123456', '确认密码': '123456', '角色': 1 },
      { '用户名': 'li.si', '显示名称': '李四', '邮箱': 'li.si@example.com', '密码': '123456', '确认密码': '123456', '角色': 2 },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '用户模板');
    XLSX.writeFile(wb, '用户导入模板.xlsx');
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">导入用户</DialogTitle>
          <DialogDescription className="flex items-center gap-1 flex-wrap">从Excel文件批量导入用户。<Button variant="link" onClick={downloadTemplate} className="p-0 h-auto text-indigo-600 text-xs">下载模板</Button></DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>选择Excel文件</Label><Input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="border-slate-300" />
            <p className="text-xs text-slate-500">格式：用户名、显示名称、邮箱、密码、确认密码、角色（1=管理员，2=评审人，其他=组员）</p>
          </div>
          {importData.length > 0 && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <h3 className="font-medium mb-2 text-sm text-slate-700">预览数据（{importData.length}条）</h3>
              <div className="max-h-48 overflow-auto border border-slate-200 rounded bg-white text-xs">
                <table className="w-full">
                  <thead className="bg-slate-100 sticky top-0"><tr><th className="p-2 text-left">用户名</th><th className="p-2 text-left">显示名称</th><th className="p-2 text-left">角色</th></tr></thead>
                  <tbody>
                    {importData.slice(0, 5).map((user, idx) => (<tr key={idx} className="border-b"><td className="p-2">{user.username}</td><td className="p-2">{user.display_name}</td><td className="p-2"><RoleBadge role={user.role} /></td></tr>))}
                    {importData.length > 5 && <tr><td colSpan={3} className="p-2 text-center">... 还有 {importData.length - 5} 条</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleConfirmImport} disabled={importData.length === 0 || importing} className="bg-indigo-600 hover:bg-indigo-700">{importing ? '导入中...' : '开始导入'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
ImportDialog.displayName = 'ImportDialog';

const ApprovalDialog = memo(({ isOpen, onClose, approvals, onApprove, onReject, loading }: { isOpen: boolean; onClose: () => void; approvals: any[]; onApprove: (id: string) => void; onReject: (id: string) => void; loading: boolean; }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle className="text-lg font-bold">解锁申请审批</DialogTitle><DialogDescription>以下用户申请修改已完成的评价，请审核</DialogDescription></DialogHeader>
      <div className="max-h-96 overflow-y-auto">
        {loading ? (<div className="space-y-2"><Skeleton className="h-12 w-full" /></div>) : approvals.length === 0 ? (
          <p className="text-center text-slate-500 py-8">暂无待审批的申请</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {approvals.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.expand?.user_id?.display_name || '未知用户'}</p>
                  <p className="text-sm text-slate-500">周期：{item.expand?.cycle_id?.name || item.cycle_id}</p>
                  <p className="text-xs text-slate-400">申请时间：{new Date(item.updated).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onReject(item.id)} className="border-rose-300 text-rose-600 hover:bg-rose-50"><XCircle className="h-4 w-4 mr-1" /> 驳回</Button>
                  <Button size="sm" onClick={() => onApprove(item.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle className="h-4 w-4 mr-1" /> 批准</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>关闭</Button></DialogFooter>
    </DialogContent>
  </Dialog>
));
ApprovalDialog.displayName = 'ApprovalDialog';

export default function UserManagementPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await pb.collection('users').getList<Profile>(1, 200, { sort: 'display_name' });
      setUsers(result.items.map((r) => ({
        id: r.id,
        username: r.username ?? '',
        display_name: r.display_name || r.username || r.email || '',
        role: (['admin', 'reviewer', 'reviewee_only'].includes(r.role) ? r.role : 'reviewee_only') as UserRole,
        created_at: r.created_at ?? '',
        email: r.email ?? ''
      })));
    } catch {
      toast.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPendingApprovals = useCallback(async () => {
    if (!profile || profile.role !== 'admin') return;
    setLoadingApprovals(true);
    try {
      const result = await pb.collection('cycle_completions').getList(1, 100, {
        filter: 'unlock_requested = true && unlock_approved = false',
        expand: 'user_id,cycle_id',
        sort: '-updated'
      });
      setPendingApprovals(result.items);
    } catch {
    } finally {
      setLoadingApprovals(false);
    }
  }, [profile]);

  useEffect(() => {
    loadUsers();
    if (isAdmin) loadPendingApprovals();
  }, [isAdmin, loadUsers, loadPendingApprovals]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u => u.display_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  }, [users, searchQuery]);

  const stats = useMemo(() => ({
    total: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    reviewer: users.filter(u => u.role === 'reviewer').length,
    reviewee: users.filter(u => u.role === 'reviewee_only').length
  }), [users]);

  const openEditDialog = useCallback((user: Profile) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  }, []);

  const handleAddSubmit = useCallback(async (data: UserFormData) => {
    setFormLoading(true);
    try {
      await pb.collection('users').create(data);
      toast.success('用户添加成功');
      setIsAddDialogOpen(false);
      loadUsers();
    } catch (err: any) {
      toast.error(`添加用户失败: ${err.message || '请重试'}`);
    } finally {
      setFormLoading(false);
    }
  }, [loadUsers]);

  const handleEditSubmit = useCallback(async (data: UserFormData) => {
    if (!editingUser) return;
    setFormLoading(true);
    try {
      await pb.collection('users').update(editingUser.id, {
        display_name: data.display_name,
        role: data.role
      });
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, display_name: data.display_name, role: data.role } : u));
      toast.success('用户更新成功');
      setIsEditDialogOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      toast.error(`更新用户失败: ${err.message || '请重试'}`);
    } finally {
      setFormLoading(false);
    }
  }, [editingUser]);

  const handleDeleteUser = useCallback(async () => {
    if (!deletingUser) return;
    try {
      await pb.collection('users').delete(deletingUser.id);
      setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
      toast.success('用户删除成功');
    } catch {
      toast.error('删除用户失败');
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
    }
  }, [deletingUser]);

  const handleImportSubmit = useCallback(async (data: UserFormData[]) => {
    setFormLoading(true);
    let successCount = 0, failCount = 0;
    for (const user of data) {
      try {
        await pb.collection('users').create(user);
        successCount++;
      } catch {
        failCount++;
      }
    }
    toast.success(`导入完成！成功 ${successCount} 个，失败 ${failCount} 个`);
    loadUsers();
    setFormLoading(false);
  }, [loadUsers]);

  const handleUnlockDecision = useCallback(async (recordId: string, approved: boolean) => {
    try {
      const record = await pb.collection('cycle_completions').getOne(recordId);
      const payload = approved ? {
        unlock_approved: true,
        unlock_requested: false,
        unlock_approved_at: new Date().toISOString(),
        completed: false
      } : { unlock_requested: false };
      await pb.collection('cycle_completions').update(recordId, payload);
      if (record.user_id) {
        window.dispatchEvent(new CustomEvent('unlock-status-changed', {
          detail: {
            userId: record.user_id,
            action: approved ? 'approved' : 'rejected',
            newState: { ...payload }
          }
        }));
      }
      loadPendingApprovals();
    } catch (err) {
      toast.error('操作失败');
    }
  }, [loadPendingApprovals]);

  if (!isAdmin) return <div className="flex items-center justify-center h-64"><div className="text-center"><Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">仅管理员可访问此页面</p></div></div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden select-none">
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm"><Users className="h-5 w-5 text-white" /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">用户管理 <Badge variant="outline" className="text-xs font-normal text-slate-500 border-slate-300 bg-slate-50">管理员</Badge></h1>
              <p className="text-xs text-slate-500">管理系统用户账户、角色和权限</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 h-9 text-sm border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => { setIsApprovalDialogOpen(true); loadPendingApprovals(); }}>
              <Lock className="h-4 w-4" /> 审批解锁 {pendingApprovals.length > 0 && <Badge className="ml-1 bg-rose-500 text-white text-[10px] px-1.5">{pendingApprovals.length}</Badge>}
            </Button>
            <ImportDialog isOpen={isImportDialogOpen} onClose={() => setIsImportDialogOpen(false)} onImport={handleImportSubmit}>
              <DialogTrigger asChild><Button variant="outline" className="gap-2 h-9 text-sm border-slate-300"><FileSpreadsheet className="h-4 w-4" /> 导入用户</Button></DialogTrigger>
            </ImportDialog>
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 h-9 text-sm shadow-md" onClick={() => setIsAddDialogOpen(true)}><Plus className="h-4 w-4" /> 新增用户</Button>
          </div>
        </div>
      </div>
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="总用户" value={stats.total} icon={Users} />
          <StatCard title="管理员" value={stats.admin} icon={Shield} colorClass="text-rose-500" />
          <StatCard title="评审人" value={stats.reviewer} icon={User} colorClass="text-indigo-500" />
          <StatCard title="组员" value={stats.reviewee} icon={Eye} colorClass="text-slate-500" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900">用户列表</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="搜索姓名或用户名..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 w-64 text-sm border-slate-300" />
                  </div>
                  <Badge variant="secondary" className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700">共 {filteredUsers.length} 人</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center text-slate-500 py-16"><Users className="h-12 w-12 mx-auto mb-4 text-slate-300" /><p>{searchQuery ? '没有找到匹配的用户' : '暂无用户数据'}</p></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  <AnimatePresence>
                    {filteredUsers.map((user, index) => (
                      <UserListItem key={user.id} user={user} index={index} onEdit={openEditDialog} onDelete={(u) => {
                        setDeletingUser(u);
                        setIsDeleteDialogOpen(true);
                      }} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
      <UserFormDialog isOpen={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} mode="add" onSubmit={handleAddSubmit} loading={formLoading} />
      <UserFormDialog isOpen={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} mode="edit" initialData={editingUser || undefined} onSubmit={handleEditSubmit} loading={formLoading} />
      <ApprovalDialog isOpen={isApprovalDialogOpen} onClose={() => setIsApprovalDialogOpen(false)} approvals={pendingApprovals} onApprove={(id) => handleUnlockDecision(id, true)} onReject={(id) => handleUnlockDecision(id, false)} loading={loadingApprovals} />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除用户“{deletingUser?.display_name}”吗？此操作不可恢复，且将删除该用户的所有关联数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-rose-600 hover:bg-rose-700">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
