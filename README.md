# WACMK Blog

WACMK Blog 是一个面向内容发布与知识沉淀的全栈博客平台。它提供文章、书籍、标签、评论、附件、访问控制、内容互动、用户余额与后台站点管理能力，并支持中文和英文界面。

初版以同域部署为目标：React 单页应用与 Django API 由同一个站点域名提供服务。

## 功能概览

- 用户注册、登录、JWT 刷新、邮箱验证和密码重置
- 文章与书籍的创建、编辑、草稿、分类标签和公开链接
- 富文本/Markdown 内容编辑、图片、视频与附件管理
- 面向公开、VIP、付费、积分、密码和书籍归属的资源访问控制
- 点赞、收藏、评论、阅读统计和后台审计日志
- ZincSearch 全文搜索与索引重建命令
- 站点基础配置、用户管理和审计日志清理

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 | Python、Django 5.1-6.0、Django REST Framework |
| 认证 | Simple JWT（30 分钟访问令牌、14 天刷新令牌） |
| 数据库 | MySQL（utf8mb4） |
| 搜索 | ZincSearch |
| 前端 | React 18、Vite 5、React Router 6 |
| 测试 | Django TestCase、Vitest |

## 目录结构

```text
wacmk-blog-2/
├── backend/
│   ├── .env.example                 # 后端环境变量模板
│   ├── config/settings/             # base、dev、test 设置
│   ├── apps/                        # Django 业务应用
│   │   └── */migrations/0001_initial.py
│   ├── staticfiles/                 # 前端构建产物和 collectstatic 输出（生成目录）
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
├── media/                           # 用户上传和站点资源（持久化目录）
└── README.md
```

## 前置条件

- Python 3.10 或更高版本
- Node.js 18 或更高版本，随附 npm
- 可访问的 MySQL 服务和具备建表权限的数据库账号
- 可访问的 ZincSearch 服务

本项目的正常运行数据库是 MySQL；SQLite 仅用于测试设置，不能作为本地或生产运行数据库的替代。

## 本地启动

### 1. 配置服务与环境变量

创建 MySQL 数据库，例如 `wacmk`，并启动 ZincSearch。然后复制后端环境变量模板：

```bash
cp backend/.env.example backend/.env
```

Windows PowerShell：

```powershell
Copy-Item backend\.env.example backend\.env
```

按实际环境修改 `backend/.env` 中的 MySQL、ZincSearch 和 SMTP 配置。示例模板仅用于开发，尤其不要在生产环境使用其中的密钥、数据库密码或 `DJANGO_DEBUG=True`。

### 2. 启动后端

```bash
cd backend
python -m venv .venv

# Linux/macOS
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

后端默认在 `http://127.0.0.1:8000` 运行。

### 3. 启动前端

另开终端：

```bash
cd frontend
npm ci
npm run dev
```

访问 `http://localhost:5173`。Vite 开发服务器会将 `/api` 请求代理到 `http://localhost:8000`。

首次建立搜索环境，或需要从 MySQL 的现有内容重建搜索索引时，执行：

```bash
cd backend
python manage.py rebuild_zinc_search_index
```

## 环境变量

后端从 `backend/.env` 加载变量。以逗号分隔的变量应避免额外空格；`DJANGO_CSRF_TRUSTED_ORIGINS` 和 `CORS_ALLOWED_ORIGINS` 必须带协议，例如 `https://blog.example.com`。

| 变量 | 用途 | 生产要求 |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | Django 密钥 | 必填，使用足够长且唯一的随机值 |
| `DJANGO_DEBUG` | 调试模式 | 必须为 `False` |
| `DJANGO_ALLOWED_HOSTS` | 允许的主机名，CSV | 必填，例如 `blog.example.com` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | 受信任来源，CSV | HTTPS 或跨域场景按需配置 |
| `DJANGO_TIME_ZONE` | 时区 | 默认 `Asia/Shanghai` |
| `DJANGO_LOG_LEVEL` | 日志等级 | 默认 `INFO` |
| `MYSQL_DATABASE` | MySQL 数据库名 | 必填 |
| `MYSQL_USER` / `MYSQL_PASSWORD` | MySQL 凭据 | 必填 |
| `MYSQL_HOST` / `MYSQL_PORT` | MySQL 地址 | 默认 `127.0.0.1` / `3306` |
| `APP_NAME` | 站点显示名称 | 默认 `WACMK` |
| `CORS_ALLOWED_ORIGINS` | 跨域前端来源，CSV | 同域部署通常无需添加生产域名 |
| `ZINC_SEARCH_API_ENDPOINT` | ZincSearch API 地址 | 必填，例如 `http://zincsearch:4080` |
| `ZINC_SEARCH_USERNAME` / `ZINC_SEARCH_PASSWORD` | ZincSearch 凭据 | 按服务配置填写 |
| `ZINC_SEARCH_QUERY_CACHE_TTL_SECONDS` | 查询缓存秒数 | 默认 `300` |
| `ZINC_SEARCH_CURSOR_SCAN_BATCH_SIZE` | 索引扫描批量大小 | 默认 `100` |
| `EMAIL_BACKEND` | Django 邮件后端 | 生产使用 SMTP 后端 |
| `EMAIL_HOST` / `EMAIL_PORT` | SMTP 地址 | 邮箱验证和重置密码必填 |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | SMTP 凭据 | 邮箱验证和重置密码必填 |
| `EMAIL_USE_TLS` | SMTP TLS 开关 | 通常为 `true` |
| `DEFAULT_FROM_EMAIL` | 发件人地址 | 邮箱验证和重置密码必填 |

## 生产部署

### 部署拓扑

当前前端使用相对 API 地址 `/api`，构建结果写入 `backend/staticfiles/`。推荐由 Nginx 等反向代理提供同域入口：

```text
浏览器
  -> Nginx（HTTPS、/static/、/media/、SPA history fallback）
  -> Gunicorn（Django：/api/、/admin/、/i18n/）
  -> MySQL
  -> ZincSearch
```

前后端使用不同域名时，前端域名必须代理 `/api` 到 Django，或需要另行改造前端 API 基地址配置；当前项目没有 `VITE_*` API 地址变量。

### 发布步骤

以下命令假定项目部署在 `/srv/wacmk-blog-2`，并在 `backend/.venv` 使用 Python 虚拟环境。根据实际路径、域名和服务账户替换示例值。

1. 准备 MySQL、ZincSearch，并为应用创建数据库和最小权限账号。
2. 创建 `backend/.env`，设置唯一的 `DJANGO_SECRET_KEY`、`DJANGO_DEBUG=False`、生产域名、MySQL、ZincSearch 和 SMTP 参数。
3. 安装依赖并构建前端：

```bash
cd /srv/wacmk-blog-2/backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt

cd /srv/wacmk-blog-2/frontend
npm ci
npm run build
```

4. 创建数据库结构和静态资源：

```bash
cd /srv/wacmk-blog-2/backend
.venv/bin/python manage.py migrate
.venv/bin/python manage.py collectstatic --noinput
.venv/bin/python manage.py rebuild_zinc_search_index
```

5. 使用生产 WSGI 服务启动 Django。项目依赖清单未内置 Gunicorn，请由部署环境安装并固定相应版本：

```bash
cd /srv/wacmk-blog-2/backend
.venv/bin/pip install gunicorn
.venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3
```

`manage.py`、WSGI 和 ASGI 默认加载 `config.settings.dev`。生产进程必须显式设置 `DJANGO_SETTINGS_MODULE=config.settings.base`，并依靠 `backend/.env` 中的 `DJANGO_DEBUG=False` 启动。例如：

```bash
DJANGO_SETTINGS_MODULE=config.settings.base .venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3
```

6. 使用 systemd、Supervisor 或容器编排工具守护上述进程，并将日志收集到持久化日志系统。

### Nginx 示例

以下示例将 API 交给 Django，直接提供构建后的静态文件和上传资源，并将未知的前端路径回退到 React 的 `index.html`：

```nginx
server {
    listen 80;
    server_name blog.example.com;

    # 生产环境应配置 TLS，并将 HTTP 重定向到 HTTPS。
    client_max_body_size 50m;

    location /static/ {
        alias /srv/wacmk-blog-2/backend/staticfiles/;
        try_files $uri =404;
    }

    location /media/ {
        alias /srv/wacmk-blog-2/media/;
        try_files $uri =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /i18n/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root /srv/wacmk-blog-2/backend/staticfiles;
        try_files $uri $uri/ /index.html;
    }
}
```

请确保 Nginx 进程有读取 `backend/staticfiles/` 和 `media/` 的权限，Django 服务账户有写入 `media/` 的权限。若上传文件包含受保护内容，不能仅依赖上例中对 `/media/` 的公开静态暴露，应按访问策略改为由受鉴权接口下载。

## 首版数据库与迁移

本初版将每个含数据模型的本地 Django 应用压缩为唯一的 `0001_initial.py`：`users`、`tags`、`resources`、`comments`、`site_settings` 和 `dashboard`。新数据库只需执行：

```bash
cd backend
python manage.py migrate
```

该迁移基线只适用于全新数据库。它不包含历史版本的数据转换或旧表修复逻辑，例如 `post` 到 `article` 的数据值转换、旧书籍结构字段修复，以及站点设置键名转换。不要将此版本的迁移直接应用到已运行旧迁移历史的数据库；如需保留旧数据，应先在旧版本完整执行历史迁移、备份并验证数据，再规划独立的数据迁移方案。

## 运维与验证

每次发布后建议依次验证：

- 首页及任意深层前端路由刷新后仍能正常加载
- `/api/` 业务接口、`/admin/` 后台和登录/刷新令牌流程
- 文章、附件上传和下载的权限及存储行为
- 注册或密码重置邮件的实际投递
- ZincSearch 搜索结果；必要时重新执行 `rebuild_zinc_search_index`

MySQL 数据库和根目录 `media/` 是持久化数据，应分别备份并定期演练恢复。`backend/staticfiles/` 是可由前端构建和 `collectstatic` 重建的生成目录。

### 审计日志清理

先在 **网站管理 -> Basic -> Audit logs** 启用保留策略并设置保留天数，再进行试运行：

```bash
cd backend
python manage.py cleanup_audit_logs --dry-run
```

每天执行一次实际清理任务：

```cron
15 2 * * * /srv/wacmk-blog-2/backend/.venv/bin/python /srv/wacmk-blog-2/backend/manage.py cleanup_audit_logs
```

定时任务应使用与 Web 服务相同的虚拟环境、`backend/.env`、数据库权限和工作环境。当前命令锁基于本地内存缓存；多实例部署时，应确保仅有一个调度器执行该任务，或改用共享锁。

Windows Task Scheduler 中，程序选择虚拟环境的 `python.exe`，参数填写 `backend\manage.py cleanup_audit_logs` 的绝对路径，并将 **Start in** 设为 `backend` 目录。
