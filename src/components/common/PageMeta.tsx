import { HelmetProvider, Helmet } from "react-helmet-async";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReactNode } from "react";

// 应用基础名称，用于页面标题拼接
const APP_BASE_NAME = "评价管理系统";

export interface PageMetaProps {
  title?: string;
  description?: string;
}

/**
 * 页面元信息组件
 * 自动处理标题格式：页面标题 | 应用名称
 */
export const PageMeta = ({
  title = "Loading...", // 默认加载中标题
  description = "基于 React 和 TypeScript 构建的现代化评价管理系统",
}: PageMetaProps) => {
  // 如果传入了 title 且不是默认值，则拼接应用名称
  const fullTitle = title ? `${title} | ${APP_BASE_NAME}` : APP_BASE_NAME;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
    </Helmet>
  );
};

/**
 * 应用层级包裹器
 * 提供 React Helmet 和 Tooltip 的全局上下文
 */
export const AppWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <HelmetProvider>
      <TooltipProvider
        delayDuration={300} // 优化：减少延迟，让提示反馈更即时
        skipDelayDuration={500}
      >
        {children}
      </TooltipProvider>
    </HelmetProvider>
  );
};

export default PageMeta;
