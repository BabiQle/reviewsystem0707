import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Observer } from 'tailwindcss-intersect';

const IntersectObserver = () => {
  const location = useLocation();

  // 封装重启逻辑，使用 RAF 优化性能
  const handleRestart = useCallback(() => {
    requestAnimationFrame(() => {
      // 双重保险：确保 Observer 存在
      if (typeof Observer !== 'undefined' && Observer.restart) {
        Observer.restart();
      }
    });
  }, []);

  useEffect(() => {
    // 监听路由变化
    // 延迟执行原因：
    // 1. 等待 React 完成虚拟 DOM 到真实 DOM 的更新。
    // 2. 等待 Lazy Load 组件加载完成（App.tsx 中使用了 lazy，需要预留加载时间）。
    const timer = setTimeout(handleRestart, 200);

    return () => clearTimeout(timer);
  }, [location, handleRestart]);

  return null;
};

export default IntersectObserver;
