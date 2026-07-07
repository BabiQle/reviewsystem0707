import { lazy, Suspense, memo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import PageLoader from '@/components/common/PageLoader';

// ========== 版本常量配置 ==========
const RAW_VERSION = "v1.1 | 2026.06.26";

// 侧边栏短格式：把 | 替换成 on
export const APP_VERSION_SHORT = RAW_VERSION.replace('|', 'on');

// 指南页长格式：前面拼接文字
export const APP_VERSION_FULL = `版本 ${RAW_VERSION}`;

// ========== 懒加载页面组件 ==========
// 按功能分组排列，便于维护
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const AppLayout = lazy(() => import('@/components/layouts/AppLayout'));

// 核心业务页面
const ReviewPage = lazy(() => import('@/pages/ReviewPage'));
const MyReviewsPage = lazy(() => import('@/pages/MyReviewsPage'));
const MyStatsPage = lazy(() => import('@/pages/MyStatsPage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));
const TrendAnalysisPage = lazy(() => import('@/pages/TrendAnalysisPage'));
const GuidePage = lazy(() => import('@/pages/Guide'));

// 管理后台页面
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage'));
const CycleManagementPage = lazy(() => import('@/pages/admin/CycleManagementPage'));

// ========== 路由默认跳转逻辑 ==========
// 使用 memo 包裹，避免 Route 组件每次渲染时都重新创建此组件实例
const DefaultRedirect = memo(function DefaultRedirect() {
  const { profile } = useAuth();
  // 默认角色为普通用户 (如果 profile 还在加载中，先给个默认值，虽然 RouteGuard 会拦截)
  const role = profile?.role ?? 'reviewee_only';

  // 管理员默认跳转填写评价，普通用户默认跳转我的评价
  const to = role === 'reviewer' || role === 'admin' ? '/review' : '/my-reviews';

  return <Navigate to={to} replace />;
});
DefaultRedirect.displayName = 'DefaultRedirect';

// ========== 应用内容布局 ==========
function AppContent() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* 登录页无需权限验证，且包含在 Suspense 中 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 主应用布局 */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DefaultRedirect />} />

          {/* 评价相关 */}
          <Route path="review" element={<ReviewPage />} />
          <Route path="my-reviews" element={<MyReviewsPage />} />

          {/* 统计相关 */}
          <Route path="my-stats" element={<MyStatsPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="trend" element={<TrendAnalysisPage />} />

          {/* 管理相关 */}
          <Route path="admin/users" element={<UserManagementPage />} />
          <Route path="admin/cycles" element={<CycleManagementPage />} />

          {/* 其他 */}
          <Route path="guide" element={<GuidePage />} />
        </Route>

        {/* 404 重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* 全局通知组件 */}
      <Toaster />
    </Suspense>
  );
}

// ========== 主组件入口 ==========
const App: React.FC = () => {
  return (
    <Router>
      {/* 路由守卫包裹：处理全局登录拦截 */}
      <RouteGuard>
        <AppContent />
      </RouteGuard>
    </Router>
  );
};

export default App;
