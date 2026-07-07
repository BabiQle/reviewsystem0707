import { Link } from "react-router-dom";
import PageMeta from "@/components/common/PageMeta";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <>
      <PageMeta title="页面未找到" description="" />
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-slate-300 mb-2">404</h1>
            <h2 className="text-xl font-semibold text-slate-900">页面未找到</h2>
            <p className="text-slate-500 mt-2 text-sm">
              您访问的页面可能已被删除、移动或不存在。
            </p>
          </div>
          <div className="flex justify-center mb-8">
            <svg className="w-32 h-32 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-100 h-10 px-6">
            <Link to="/" className="gap-2">
              <Home className="w-4 h-4" />
              返回首页
            </Link>
          </Button>
        </div>
        <p className="absolute bottom-6 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} 团队互评平台
        </p>
      </div>
    </>
  );
}
