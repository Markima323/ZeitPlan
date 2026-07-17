# ZeitPlan

## Shared production gateway

The production Nginx also serves `lebenslauf.markima.de` for the CreateResume project on the same Hetzner server. Both Compose projects join the external Docker network `public-proxy`; CreateResume is reachable through the network aliases `resume-frontend` and `resume-backend`. The Lebenslauf virtual host is protected by `infra/nginx/.htpasswd`, which must exist only on the server and is intentionally ignored by Git.

See the CreateResume deployment guide at `docs/服务器部署.md` in the CreateResume repository for DNS, certificate expansion, Basic Auth and deployment order.

一个围绕德国本地时间与北京时间联动的日程管理项目。它把一天拆成可插入、可删除的任务块，自动在任务之间插入 5 分钟休息，并提供任务类型管理、后台统计、图片复制和奖励骰子功能。

## 技术栈

- 前端：React + Vite
- 后端：Java 21 + Spring Boot 3 + Maven
- 数据库：PostgreSQL
- 容器化：Docker + Docker Compose
- 反向代理：Nginx
- HTTPS 证书：Let's Encrypt / Certbot
- CI/CD：GitHub Actions
- 目标部署：Hetzner

## 已实现的核心功能

- 热加载开发环境：`docker compose up` 可同时启动 PostgreSQL、Spring Boot DevTools 和 Vite HMR
- 日程编辑器：支持在任意任务块之间插入、删除
- 自动时间表：只允许 30 分钟和 60 分钟任务，任务之间自动插入不可编辑的 5 分钟休息
- 中德时间联动：夏令时 +6、冬令时 +7
- 任务类型管理：图标、颜色、描述可增删改
- 统计后台：查看每天的计划以及按任务类型聚合的总时长
- 奖励骰子页：当天 17:00 后最多两次投掷，包含动画、音效和历史侧边栏
- 复制为图片：把右侧日程预览生成 PNG 并写入剪贴板

## 目录结构

```text
.
├─ frontend/                React 前端
├─ backend/                 Spring Boot 后端
├─ infra/nginx/             Nginx 反向代理模板
├─ docker-compose.yml       本地开发环境
├─ docker-compose.prod.yml  生产部署环境
├─ .env.example             生产环境变量样例
├─ plan.jsx / plan.css      你给的 UI 示例参考
└─ .github/workflows/       CI / CD 工作流
```

## 本地开发

### 方式 1：直接本机运行

1. 启动 PostgreSQL，创建数据库 `zeitplan`
2. 后端：

```bash
cd backend
./mvnw spring-boot:run
```

3. 前端：

```bash
cd frontend
npm install
npm run dev
```

4. 打开 `http://localhost:5175`

### 方式 2：Docker 热加载

```bash
docker compose up
```

启动后：

- 前端：`http://localhost:5175`
- 后端：`http://localhost:8282`
- PostgreSQL：`localhost:5432`

热加载说明：

- 前端：Vite HMR，保存 `frontend/src` 下文件后页面会自动刷新或局部热更新
- 后端：`backend/src/main` 或 `backend/pom.xml` 变化后，开发容器会自动重新编译，Spring DevTools 会自动重启应用
- 不需要重新执行 `docker compose up --build`

## 生产部署到 Hetzner

1. 把仓库拉到服务器，例如 `/srv/zeitplan`
2. 复制环境变量文件：

```bash
cp .env.example .env
```

3. 按实际域名填写 `.env` 中的 `SERVER_NAME` 和数据库密码
4. 首次签发证书前，确保域名 A 记录已经指向 Hetzner 服务器
5. 使用 Certbot 一次性申请证书：

```bash
docker compose --env-file .env -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot -d your-domain.example.com
```

6. 启动生产环境：

```bash
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

## GitHub Actions

### `ci.yml`

- 安装前端依赖并构建
- 使用 Java 21 运行后端测试

### `deploy.yml`

需要配置以下 Secrets：

- `HETZNER_HOST`
- `HETZNER_USER`
- `HETZNER_SSH_KEY`
- `HETZNER_DEPLOY_PATH`

推送到 `main` 后，工作流会：

- 通过 SSH 连接 Hetzner
- 在部署目录执行 `git pull --ff-only`
- 重新构建并启动 `docker-compose.prod.yml`
