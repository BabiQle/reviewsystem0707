# Cloudflare Tunnel 公网穿透配置指南

## 环境信息

| 项目 | 值 |
|------|-----|
| 本机内网 IP | 10.80.159.174 |
| PocketBase | D:\PB (端口 8091) |
| 前端 Vite | D:\review-system-new - codex (端口 5173) |
| 穿透工具 | cloudflared |
| 协议 | HTTPS 强制 |

---

## 一、前置准备

### 1. 域名 DNS 托管在 Cloudflare

Cloudflare Tunnel 要求你的域名 DNS 托管在 Cloudflare 上。

**如果没有域名：**
1. 前往 https://www.cloudflare.com/ 注册账号
2. 在 Domains 中购买域名（如 mysite.com）

**DNS 迁移（如果域名不在 CF 上）：**
1. 在 Cloudflare 点击 "Add a Domain"，输入你的域名
2. CF 会给出两组 Nameserver，如 nathan.ns.cloudflare.com / lucy.ns.cloudflare.com
3. 到域名注册商的 DNS 管理页，将 Nameserver 替换为 CF 提供的地址
4. 等待 DNS 生效（通常几分钟到 24 小时）

### 2. 下载 cloudflared

从 https://github.com/cloudflare/cloudflared/releases 下载最新版 Windows amd64：

```
cloudflared-windows-amd64.exe
```

重命名为 cloudflared.exe，放到：
```
D:\review-system-new - codex\scripts\cloudflared.exe
```

---

## 二、一键初始化配置

双击运行：
```
D:\review-system-new - codex\scripts\setup-tunnel.bat
```

该脚本会自动引导完成：
1. OAuth 认证 - 浏览器登录 Cloudflare 账号
2. 创建两个 Tunnel - 一个给前端，一个给 PocketBase
3. 绑定子域名 - 分别为前端和 PB 分配独立子域名
4. 生成 .env.production - 自动填入 PB 的公网地址

### 手动创建 Tunnel（备选）

```powershell
cd "D:\review-system-new - codex\scripts"

# 认证
.\cloudflared.exe tunnel login

# 创建前端隧道
.\cloudflared.exe tunnel --no-autoupdate create review-frontend
# 记下 UUID

# 创建 PB 隧道
.\cloudflared.exe tunnel --no-autoupdate create review-pb
# 记下 UUID

# 绑定域名（替换为你的实际域名）
.\cloudflared.exe tunnel --no-autoupdate route dns review-frontend app.mysite.com
.\cloudflared.exe tunnel --no-autoupdate route dns review-pb api.mysite.com
```

绑定成功输出：
```
Route dns added successfully
  Tunnel:   review-pb
  Domain:   api.mysite.com
```

---

## 三、CF 域名绑定详解

### 方案 A：独立子域名（推荐，本项目默认）

Tunnel 自动在 CF DNS 创建 CNAME 记录：

```
app.mysite.com  ->  <frontend-tunnel-uuid>.cfargotunnel.com
api.mysite.com  ->  <pb-tunnel-uuid>.cfargotunnel.com
```

无需手动添加 DNS 记录，`route dns` 命令已自动处理。

### 方案 B：合并为单 Tunnel + 多路由

如果想用一个 Tunnel 管理两个服务，创建 `cloudflared-combined.toml`：

```toml
credentials-file: D:\review-system-new - codex\scripts\tunnel-creds.json

ingress:
  - hostname: app.mysite.com
    service: http://10.80.159.174:5173
  - hostname: api.mysite.com
    service: http://10.80.159.174:8091
  - service: http_status:404
```

启动：
```powershell
.\cloudflared.exe tunnel --config "D:\review-system-new - codex\scripts\cloudflared-combined.toml" run
```

---

## 四、PocketBase 跨域配置

### 问题原因

PocketBase 默认只允许 127.0.0.1 访问。公网部署必须配置 CORS。

### 方法 1：动态配置钩子（推荐）

在 `D:\PB` 下创建 `pb_hooks\init.pb.js`：

```javascript
pb.hooks("onBootstrap").add(function (e) {
  e.dynamicSettings = {
    cors: {
      origins: [
        "https://app.mysite.com",
        "https://api.mysite.com"
      ],
      allowUploadOrigin: true
    }
  };
});
```

> 将域名替换为你实际的子域名。每次 PB 启动自动生效。

### 方法 2：编辑 config.json

启动一次 PB 后，编辑 `D:\PB\pb_data\config.json`：

```json
{
  "cors": {
    "origins": ["https://app.mysite.com", "https://api.mysite.com"],
    "allowUploadOrigin": true
  }
}
```

---

## 五、构建前端

### 1. 确认 .env.production

运行 `setup-tunnel.bat` 后自动生成：

```env
VITE_PB_URL=https://api.mysite.com
```

如需手动修改，编辑 `D:\review-system-new - codex\.env.production`。

### 2. 构建

```powershell
cd "D:\review-system-new - codex"
npm run build
```

产物在 `dist\` 目录。

### 3. 验证

确认 `dist\index.html` 存在，Vite 默认使用相对路径，适合 Tunnel 部署。

---

## 六、启动所有服务

### 方式一：一键启动

```
D:\review-system-new - codex\scripts\start-all.bat
```

依次启动：
1. PocketBase（端口 8091，绑定 10.80.159.174）
2. 前端 Tunnel
3. PB Tunnel

### 方式二：手动启动

```powershell
# 终端 1: PocketBase
cd D:\PB
.\pocketbase.exe serve --http 10.80.159.174:8091

# 终端 2: 前端 Tunnel
cd "D:\review-system-new - codex\scripts"
.\cloudflared.exe tunnel --config "cloudflared-frontend.toml" run

# 终端 3: PB Tunnel
.\cloudflared.exe tunnel --config "cloudflared-pb.toml" run
```

### 查看 Tunnel 状态

```powershell
start http://localhost:3821   # 前端 Tunnel 监控
start http://localhost:3822   # PB Tunnel 监控
```

### 停止服务

```
D:\review-system-new - codex\scripts\stop-all.bat
```

---

## 七、公网访问验证

| 服务 | 地址 |
|------|------|
| 前端 | https://app.mysite.com |
| PB Admin | https://api.mysite.com/_/ |
| PB API | https://api.mysite.com/api/ |

### 常见问题

| 问题 | 解决 |
|------|------|
| 前端空白/404 | 确认已执行 npm run build |
| 文件上传失败 | 检查 PB CORS origins 是否包含前端域名 |
| Tunnel 断开 | 查看 logs/ 目录下的日志文件 |
| SSL 证书错误 | 等待 1-2 分钟让 CF 证书生效 |

---

## 八、开机自启

### 使用 NSSM 注册为 Windows 服务

```powershell
# 下载 NSSM: https://nssm.cc/download

nssm install "Review-Frontend-Tunnel" "D:\review-system-new - codex\scripts\cloudflared.exe"
nssm set "Review-Frontend-Tunnel" AppParameters "tunnel --config D:\review-system-new - codex\scripts\cloudflared-frontend.toml run"
nssm set "Review-Frontend-Tunnel" Start SERVICE_AUTO_START
nssm start "Review-Frontend-Tunnel"

nssm install "Review-PB-Tunnel" "D:\review-system-new - codex\scripts\cloudflared.exe"
nssm set "Review-PB-Tunnel" AppParameters "tunnel --config D:\review-system-new - codex\scripts\cloudflared-pb.toml run"
nssm set "Review-PB-Tunnel" Start SERVICE_AUTO_START
nssm start "Review-PB-Tunnel"
```

---

## 九、文件清单

```
D:\review-system-new - codex\
+-- scripts/
|   +-- setup-tunnel.bat          # 一次性初始化向导
|   +-- start-all.bat             # 一键启动
|   +-- stop-all.bat              # 停止所有服务
|   +-- cloudflared-frontend.toml # 前端 Tunnel 配置
|   +-- cloudflared-pb.toml       # PB Tunnel 配置
|   +-- cloudflared.exe           # 下载放置位置
|   +-- frontend-uuid.txt         # 自动生成
|   +-- pb-uuid.txt               # 自动生成
|   +-- tunnel-creds.json         # 自动生成
|   +-- .tunnel-token.txt         # 手动 Token 备份
+-- logs/                         # Tunnel 日志
|   +-- frontend-tunnel.log
|   +-- pb-tunnel.log
+-- pb_hooks/
|   +-- init.pb.js                # 手动创建（CORS 钩子）
+-- .env.production               # 自动生成
+-- docs/
    +-- CF_DOMAIN_BIND_GUIDE.md   # 本文档
```