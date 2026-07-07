import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { AppWrapper } from './components/common/PageMeta';
import { AuthProvider } from './contexts/AuthContext';

// 1. 获取根节点并增加安全检查
const container = document.getElementById('root');

if (!container) {
  throw new Error('未找到根容器 #root，请检查 index.html');
}

// 2. 创建 React Root
const root = createRoot(container);

// 3. 渲染应用
root.render(
  <StrictMode>
    <AppWrapper>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppWrapper>
  </StrictMode>
);
