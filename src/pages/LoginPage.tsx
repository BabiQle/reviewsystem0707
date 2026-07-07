import React, { useState, useEffect } from 'react'; // 🔥 修复：显式导入 React 以支持 React.memo
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Lock, User, CheckCircle2, XCircle, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 类型定义 ---
interface FormInputProps {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  icon: LucideIcon;
  autoComplete: string;
  disabled?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface AlertMessageProps {
  message: string;
  type: 'success' | 'error';
}

// --- 子组件：表单输入框 (使用 memo 优化) ---
const FormInput = React.memo<FormInputProps>(({
  id, label, type, placeholder, value, icon: Icon, autoComplete, disabled, onChange
}) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="text-sm font-medium text-foreground">{label}</Label>
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="pl-10 h-10 border-input bg-background focus-visible:ring-primary"
        autoComplete={autoComplete}
      />
    </div>
  </div>
));
FormInput.displayName = 'FormInput';

// --- 子组件：状态提示信息 (封装动画逻辑) ---
const AlertMessage = React.memo<AlertMessageProps>(({ message, type }) => {
  if (!message) return null;

  const isSuccess = type === 'success';
  // 使用主题色变量适配暗黑模式
  const bgClass = isSuccess
    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
    : 'bg-destructive/10 border-destructive/20 text-destructive dark:text-red-400';
  const Icon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`mb-4 p-3 rounded-lg border text-sm flex items-center gap-2 ${bgClass}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {message}
    </motion.div>
  );
});
AlertMessage.displayName = 'AlertMessage';

// --- 主页面组件 ---
export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 假设你的 AuthContext 里有这个方法，如果没有请替换为 login
  const { signInWithUsername } = useAuth();
  const navigate = useNavigate();

  // 登录成功后跳转
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [successMessage, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setErrorMessage('请输入用户名和密码');
      return;
    }

    setLoading(true);
    // 调用登录方法
    const { error } = await signInWithUsername(trimmedUsername, trimmedPassword);
    setLoading(false);

    if (error) {
      setErrorMessage('用户名或密码错误，请重试');
      setPassword('');
    } else {
      setSuccessMessage('登录成功，欢迎回来！');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4 select-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* 顶部 Logo */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-4 shadow-lg shadow-primary/20"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} // 减慢旋转速度，更优雅
          >
            <Users className="w-8 h-8 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">团队互评平台</h1>
          <p className="text-sm text-muted-foreground mt-1">成员互评数据管理</p>
        </div>

        {/* 登录卡片 */}
        <Card className="shadow-xl border-border bg-card/95 backdrop-blur-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-4 pt-6 px-6 bg-muted/30 border-b border-border">
            <CardTitle className="text-lg font-bold text-foreground">账号登录</CardTitle>
            <CardDescription className="text-muted-foreground">请输入您的登录凭证</CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {errorMessage && <AlertMessage key="error" message={errorMessage} type="error" />}
              {successMessage && <AlertMessage key="success" message={successMessage} type="success" />}
            </AnimatePresence>

            <form onSubmit={handleLogin} className="space-y-5">
              <FormInput
                id="username"
                label="用户名"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                icon={User}
                disabled={loading}
                autoComplete="username"
              />

              <FormInput
                id="password"
                label="密码"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={Lock}
                disabled={loading}
                autoComplete="current-password"
              />

              <Button
                type="submit"
                className="w-full h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md shadow-primary/20 transition-all"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                    登录中...
                  </span>
                ) : (
                  '登录'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          如无账号，请联系系统管理员创建
        </p>
      </motion.div>
    </div>
  );
}
