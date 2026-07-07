import { useEffect, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
}

const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">加载中...</p>
    </div>
  </div>
);

const RouteGuardInner = memo(function RouteGuardInner({ children }: RouteGuardProps) {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    // 登录页不需要拦截
    if (location.pathname === '/login') return;
    if (!profile) {
      navigate('/login', { replace: true });
    }
  }, [profile, loading, navigate, location.pathname]);

  if (loading) {
    return <LoadingScreen />;
  }

  // 登录页直接放行，不拦截
  if (location.pathname === '/login') {
    return <>{children}</>;
  }

  // 未登录且不在登录页 → 不渲染（由 useEffect 重定向）
  if (!profile) {
    return null;
  }

  return <>{children}</>;
});

RouteGuardInner.displayName = 'RouteGuardInner';

export const RouteGuard = RouteGuardInner;
export default RouteGuard;