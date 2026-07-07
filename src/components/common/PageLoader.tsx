import { Skeleton } from '@/components/ui/skeleton';

// 配置常量，方便调整骨架数量
const SIDEBAR_ITEMS_COUNT = 6;
const GRID_ITEMS_COUNT = 3;

export default function PageLoader() {
  return (
    <div className="flex h-screen w-full bg-background">
      {/* 左侧侧边栏骨架 */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-sidebar p-4">
        {/* Logo 区域 */}
        <div className="flex items-center gap-2.5 mb-6 h-[60px] shrink-0">
          <Skeleton className="w-8 h-8 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>

        {/* 导航列表 */}
        <div className="space-y-2 flex-1 overflow-hidden">
          {Array.from({ length: SIDEBAR_ITEMS_COUNT }).map((_, i) => (
            <Skeleton key={`nav-${i}`} className="h-9 w-full rounded-md" />
          ))}
        </div>

        {/* 底部用户区域 */}
        <div className="pt-4 border-t border-sidebar-border">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </aside>

      {/* 右侧内容区骨架 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 移动端 Header：模拟汉堡菜单 + 标题 */}
        <header className="md:hidden flex items-center gap-3 h-14 px-4 border-b border-border bg-card shrink-0">
          <Skeleton className="w-8 h-8 rounded" />
          <Skeleton className="h-5 w-32" />
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* 页面标题 */}
            <Skeleton className="h-8 w-48 rounded" />

            {/* 主内容卡片 */}
            <Skeleton className="h-40 w-full rounded-xl" />

            {/* 数据网格 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: GRID_ITEMS_COUNT }).map((_, i) => (
                <Skeleton key={`grid-${i}`} className="h-24 w-full rounded-xl" />
              ))}
            </div>

            {/* 表格/长内容 */}
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </main>
      </div>
    </div>
  );
}
