# Cloudflare Tunnel 配置与故障排查手册

## 一、CF DNS 页面校验步骤

### 目标
确认 web.teamrate.top 和 api.teamrate.top 的 DNS 记录为 **灰色云朵 (DNS Only)**。

### 操作步骤

1. 打开 https://dash.cloudflare.com
2. 点击域名 **teamrate.top**
3. 左侧菜单点击 **DNS** -> **Records**
4. 找到以下两条记录：

| Name | Type | Target | Proxied | 状态 |
|------|------|--------|---------|------|
| web | CNAME | <tunnel-uuid>.cfargotunnel.com | DNS only (灰色) | OK |
| api | CNAME | <tunnel-uuid>.cfargotunnel.com | DNS only (灰色) | OK |

### 如果是橙色云朵 (Proxied)

橙色云朵表示流量经过 Cloudflare 缓存/代理层，**隧道模式下必须关闭代理**。

**修改方法：**
1. 在 Records 页面找到 web.teamrate.top 的记录
2. 点击记录右侧的 **编辑** 按钮
3. 将 **Proxy status** 从 Proxied (Orange) 改为 DNS only (Grey)
4. 点击 **保存**
5. 对 api.teamrate.top 重复同样操作
6. 保存后等待 1-2 分钟让 DNS 生效

### 验证 DNS 是否生效

在 CMD 中运行：
```
nslookup web.teamrate.top 1.1.1.1
nslookup api.teamrate.top 1.1.1.1
```

正确输出应显示 CNAME 指向 `<你的Tunnel-UUID>.cfargotunnel.com`，而不是 Cloudflare 的代理 IP（172.67.x.x / 104.21.x.x）。

---

## 二、启动脚本使用说明

### 启动隧道
```powershell
cd D:\\review-system-new - codex\\scripts
.\\start-tunnel.ps1
```

脚本会自动：
1. 检测 cloudflared.exe 是否存在
2. 检测 tunnel-creds.json 是否存在
3. 检测 localhost:5173 (前端) 和 10.80.159.174:8091 (PB) 是否可访问
4. 如果有旧隧道进程则自动停止
5. 启动新隧道并输出日志到 logs/tunnel.log
6. 显示公网访问地址

### 停止隧道
```powershell
.\\stop-tunnel.ps1
```

### 实时查看日志
```powershell
.\\watch-tunnel-log.ps1
```

或在 CMD 中：
```
powershell -Command "Get-Content 'D:\\review-system-new - codex\\logs\\tunnel.log' -Wait -Tail 0"
```
---

## 三、故障排查方案

### 1. 浏览器打不开域名，日志完全无输出

**可能原因：** 隧道未启动或隧道配置错误

**排查步骤：**

```powershell
# 检查隧道进程是否在运行
Get-Process -Name cloudflared

# 检查日志文件内容
Get-Content 'D:\\review-system-new - codex\\logs\\tunnel.log' -Tail 30

# 检查 cloudflared 配置
Get-Content 'D:\\review-system-new - codex\\scripts\\tunnel-teamrate.toml'

# 检查凭据文件
Get-Content 'D:\\review-system-new - codex\\scripts\\tunnel-creds.json'

# 手动测试隧道连接（前台运行，直接看错误信息）
cd D:\\review-system-new - codex\\scripts
.\\cloudflared.exe --no-autoupdate tunnel --config tunnel-teamrate.toml run
```

**常见错误及解决：**

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| Cannot determine default origin certificate path | 缺少 cert.pem | 隧道使用 token 模式不需要 cert.pem，忽略此警告 |
| The credentials file contained invalid JSON | 凭据文件格式错误 | 删除 tunnel-creds.json 后重新运行 setup-tunnel.bat |
| Rule #1 is matching the hostname | ingress 规则缺少 hostname | 检查 tunnel-teamrate.toml 中每条规则都有 hostname |
| control stream encountered a failure | DNS 路由未配置 | 在 CF Dashboard 的 Tunnel 页面添加 Public Hostname 路由 |

---

### 2. 能打开 web 前端，但 api 后台 404

**原因：** PocketBase 的管理后台路径是 /_/，根路径 / 返回 404 是正常的。

**正确访问地址：**

| 服务 | 正确 URL | 说明 |
|------|---------|------|
| 前端 | https://web.teamrate.top | 主站 |
| PB 管理后台 | https://api.teamrate.top/_/ | 登录管理页面 |
| PB API | https://api.teamrate.top/api/ | REST API 接口 |

**验证 PB 是否正常响应：**
```powershell
# 本地测试
curl http://10.80.159.174:8091/_/
curl http://10.80.159.174:8091/api/records

# 公网测试
curl https://api.teamrate.top/_/
```

**如果 PB 管理页面打不开（即使本地也不行）：**

1. 确认 PB 正在运行：
   ```powershell
   netstat -ano | findstr ':8091'
   ```

2. 确认 PB 绑定的是 0.0.0.0 或 10.80.159.174：
   ```
   正确: TCP 0.0.0.0:8091
   错误: TCP 127.0.0.1:8091  (只允许本地访问)
   ```

3. 重启 PB：
   ```cmd
   cd D:\PB
   pocketbase.exe serve --http 0.0.0.0:8091
   ```

---

### 3. 隧道进程意外中断如何重启

**检测隧道状态：**
```powershell
Get-Process -Name cloudflared -ErrorAction SilentlyContinue
```
如果返回空，说明隧道已中断。

**重启步骤：**
```powershell
cd D:\\review-system-new - codex\\scripts
.\\stop-tunnel.ps1
.\\start-tunnel.ps1
```

**防止意外中断（开机自启）：**
使用 NSSM 将 cloudflared 注册为 Windows 服务：
```powershell
# 下载 NSSM: https://nssm.cc/download

nssm install 'Cloudflare-Tunnel' 'D:\\review-system-new - codex\\scripts\\cloudflared.exe'
nssm set 'Cloudflare-Tunnel' AppParameters '--no-autoupdate tunnel --config D:\\review-system-new - codex\\scripts\\tunnel-teamrate.toml run'
nssm set 'Cloudflare-Tunnel' Start SERVICE_AUTO_START
nssm set 'Cloudflare-Tunnel' Recovery Restart
nssm start 'Cloudflare-Tunnel'
```

---

### 4. 域名解析失败、NS 未生效判断方式

**判断 NS 是否已迁移到 Cloudflare：**
```cmd
nslookup teamrate.top
```

**正确输出（NS 在 CF 上）：**
``````
teamrate.top
    primary name server = milan.ns.cloudflare.com
    responsible mail addr = dns.cloudflare.com
``````

**错误输出（NS 不在 CF 上）：**
``````
teamrate.top
    nameserver = ns1.阿里云域名服务器.com
``````

**NS 未生效时的表现：**
- CF Dashboard 中域名状态显示 Pending 或 Not Active
- 无法在 CF 后台管理 DNS 记录
- 无法创建 Tunnel

**NS 迁移步骤：**
1. 在 CF Dashboard 点击 Add a Domain -> 输入 teamrate.top
2. CF 会给出两组 Nameserver
3. 到域名注册商的 DNS 管理页面，将 Nameserver 替换为 CF 提供的地址
4. 等待生效（通常 10 分钟到 24 小时）
5. 生效后 CF Dashboard 会显示 Active

**验证隧道 DNS 记录是否正确：**
```cmd
nslookup web.teamrate.top 1.1.1.1
nslookup api.teamrate.top 1.1.1.1
```

**正确输出：**
``````
Name:    cfa307e7-deb3-4603-9465-4dc094529c0c.cfargotunnel.com
Aliases:  web.teamrate.top
``````

**错误输出（仍指向 CF 代理 IP）：**
``````
Name:    web.teamrate.top
Address:  172.67.205.233
Address:  104.21.15.113
``````
-> 这说明 DNS 记录还是 A 记录或 Orange Cloud，需要改回 CNAME + Grey Cloud。

---

## 四、完整命令速查表

```powershell
# 启动隧道
cd D:\\review-system-new - codex\\scripts
.\\start-tunnel.ps1

# 停止隧道
.\\stop-tunnel.ps1

# 查看实时日志
.\\watch-tunnel-log.ps1

# 手动查看日志
Get-Content 'D:\\review-system-new - codex\\logs\\tunnel.log' -Tail 50

# 测试前端连通性
curl https://web.teamrate.top/

# 测试 PB 连通性
curl https://api.teamrate.top/_/

# 检查隧道进程
Get-Process -Name cloudflared

# 检查端口占用
netstat -ano | findstr ':5173'
netstat -ano | findstr ':8091'

# 检查 DNS 解析
nslookup web.teamrate.top 1.1.1.1
nslookup api.teamrate.top 1.1.1.1

# 检查 NS 是否生效
nslookup teamrate.top

# 前台调试隧道
cd D:\\review-system-new - codex\\scripts
.\\cloudflared.exe --no-autoupdate tunnel --config tunnel-teamrate.toml run
```

---

## 五、文件清单

``````
D:\\review-system-new - codex\\
+-- scripts/
|   +-- start-tunnel.ps1        # 启动隧道（含端口检测）
|   +-- stop-tunnel.ps1         # 停止隧道
|   +-- watch-tunnel-log.ps1    # 实时查看日志
|   +-- cloudflared.exe         # Cloudflare Tunnel 客户端
|   +-- tunnel-creds.json       # 隧道凭据
|   +-- tunnel-teamrate.toml    # 隧道配置（主配置）
|   +-- setup-tunnel.bat        # 初始化向导
+-- logs/
|   +-- tunnel.log              # 隧道运行日志
+-- docs/
|   +-- CF_DOMAIN_BIND_GUIDE.md # 详细配置教程
|   +-- TROUBLESHOOTING.md      # 本文档
+-- vite.config.ts              # 含 allowedHosts 配置
``````
---

## 五、快速临时公网访问（无需DNS配置）

如果CF DNS配置暂时无法解决IPv4解析问题，可以使用cloudflared的quick tunnel模式生成临时公网URL。

### 使用方法

```powershell
cd D:\review-system-new - codex\scripts
.\start-quick-tunnel.ps1
```

脚本会自动：
1. 检测前端(Port 5173)和PB(Port 8091)是否运行
2. 停止旧隧道进程
3. 启动两个quick tunnel（前端+PB）
4. 自动更新vite.config.ts中的allowedHosts
5. 验证公网连通性
6. 显示临时URL

### 临时URL特点

- 每次启动生成不同的URL（`xxxxxx.trycloudflare.com`）
- 无需配置CF DNS记录
- 无需灰色云朵
- 适合测试和临时分享
- 隧道会在一段时间后自动过期，需要重新启动

### 手动启动quick tunnel

```powershell
# 前端
cloudflared.exe tunnel --url http://127.0.0.1:5173 demo

# PB
cloudflared.exe tunnel --url http://10.80.159.174:8091 demo
```

输出中会显示类似 `https://xxxxxx.trycloudflare.com` 的URL。

### 当前临时URL

- 前端: https://roof-remark-score-valve.trycloudflare.com
- PB:   https://rounds-drain-editorial-fresh.trycloudflare.com/_/

> 这些URL只在本次会话有效，重启隧道后会变化。