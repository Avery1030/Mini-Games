# Avery Mini Windows Desktop

Windows 95 风格的 Web 桌面（Next.js App Router）：可拖拽图标与窗口、任务栏、开始菜单、锁屏，以及一整套内置应用——设置、文档、日志、记事本、画图、音乐、计算器、命令提示符、回收站、K 线图表、智聊，外加扫雷与俄罗斯方块。

气质是「Win95 怀旧壳 + 一点当代网页」：视觉走经典对话框质感，数据大多落在本机（`localStorage` + 项目下 `.data/`），不依赖账号体系。

---

## 快速开始

**环境要求：** Node.js 20+（建议与 Next.js 15 对齐）、包管理器任选 yarn / npm / pnpm。

```bash
# 安装依赖
yarn

# 开发（Turbopack）
yarn dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

```bash
yarn build   # 生产构建（Turbopack）
yarn start   # 启动生产服务
yarn lint    # ESLint
```

路径别名：`@/` → 项目根目录。

---

## 功能概览

### 桌面壳

| 能力 | 说明 |
| ---- | ---- |
| 桌面图标 | 拖拽与坐标记忆；右键菜单（新建文件夹 / 文本文档、排列图标、刷新、移至回收站等） |
| 文件夹 / 文本文档 | 运行时动态桌面项，可嵌套、重命名；文本文档关联记事本数据 |
| 窗口 | 拖拽、缩放、最小化 / 最大化、叠放层级；小窗边缘软吸附；关闭后几何可记忆 |
| 窗口路由 | 聚焦窗口同步地址栏 `/window/{应用}`；刷新可重开，浏览器后退 / 前进切换聚焦 |
| 任务栏 | 开始菜单、已开窗口按钮与预览、时钟与日历备注、主题切换、语言切换 |
| 锁屏 | 本机会话锁屏（密码不跨设备备份） |
| 反馈 | 全局 Modal、Toast（成功 / 失败 / 警告） |

### 内置应用

| 应用 | id | 说明 |
| ---- | -- | ---- |
| 设置 | `settings` | 显示（壁纸上传 / 导入）、外观、任务栏、数据（JSON 备份导入导出） |
| 文档 | `document` | 应用说明与更新摘要（纯前端文案） |
| 日志 | `log` | 按日期查看更新记录 |
| 记事本 | `notepad` | 纯文本笔记 CRUD；落盘 `.data/notes` |
| 画图 | `paint` | 画布、调色板、橡皮、形状；PNG 落盘 `.data/drawings` |
| 音乐 | `music` | 演示曲 + Audius 搜索 / 流式代理；可本地导入 |
| 计算器 | `calculator` | 四则运算、括号、幂、开方与简单内存键；窗口不可缩放 |
| 命令提示符 | `cmd` | DOS 风格终端（`DIR` / `CD` / `CLS` / `NOTEPAD` / `TETRIS` / `WALLPAPER` 等）；默认不占桌面图标 |
| 回收站 | `recycleBin` | 软删除桌面资源的恢复与清空 |
| K 线图表 | `klineChartViewer` | USDT 永续 K 线（币安公开接口）、周期与指标、画线工具 |
| 智聊 | `aiChat` | SiliconFlow 流式对话；API Key 存本机 store，会话落盘 `.data/ai-chat` |
| 扫雷 | `minesweeper` | 经典扫雷 |
| 俄罗斯方块 | `tetris` | 经典俄罗斯方块 |

---

## 技术栈

| 层 | 选型 |
| -- | ---- |
| 框架 | Next.js 15（App Router）+ React 19 + TypeScript |
| 样式 | Tailwind CSS 4、CSS 变量主题（配合 `next-themes`） |
| 状态 | Zustand（`persist` → `localStorage`） |
| 国际化 | next-intl（`zh-CN` / `en-US`） |
| 其它 | ahooks、date-fns、react-day-picker、klinecharts、@tanstack/react-virtual、lucide-react |

---

## 目录结构

```
app/
  (desktop)/          桌面壳页面：/ 与 /window/[slug]
  api/                Route Handlers（笔记、画图、壁纸、音乐、智聊）
  layout.tsx          根布局
components/
  desktop/            桌面壳（窗口层、任务栏、锁屏、开机屏…）
  ui/                 Win95 风格通用控件（Button / Modal / Toast / SplitPane…）
config/               桌面与壁纸等静态配置
content/              内容清单（如 changelog 日期列表）
features/             各桌面应用 UI 与业务
hooks/
  desktop/            桌面交互 hooks
  settings/           设置分区订阅
i18n/                 next-intl 路由与请求配置
lib/
  desktop/            窗口注册表、几何、吸附、路由、桌面树…
  storage/            localStorage 封装、备份、legacy 迁移
  wallpaper/ music/ notepad/ paint/ ai-chat/ …
messages/             zh-CN.json / en-US.json
store/                Zustand stores
public/               静态资源
.data/                本机服务端文件数据（gitignore，勿提交密钥）
CHANGELOG.md          仓库向更新说明
```

应用窗口定义集中在 `lib/desktop/window/apps.ts`（`DesktopWindow` 子类），经 `registry` 挂到桌面与开始菜单。

---

## 路由与中间件

| 路径 | 含义 |
| ---- | ---- |
| `/` | 桌面根视图 |
| `/window/[slug]` | 聚焦指定应用窗口（`slug` 为应用 id，如 `settings`、`notepad`） |
| `/api/*` | 服务端 API（不经 intl 重定向） |

`middleware.ts`：桌面壳路径（`/`、`/window/*`）绕过 next-intl，避免未知 path 被判 404；其余页面走 intl middleware。

聚焦窗口时由客户端 `history.pushState` / `replaceState` 同步 URL（见 `lib/desktop/windowRoute.ts`），刷新后可按 slug 重开窗口。

---

## 数据与持久化

### 浏览器 localStorage

统一由 `lib/storage` 管理（`STORAGE_KEYS` + `appStorage`）。主要 key：

| Key | 用途 |
| --- | ---- |
| `app-theme` | 明 / 暗主题（next-themes） |
| `desktop-settings` | 壁纸、图标尺寸、UI 缩放、任务栏选项等 |
| `desktop-windows` | 窗口开合、几何、zIndex |
| `desktop-coordinates` | 图标格点坐标 |
| `desktop-items` | 动态文件夹 / 文本文档等 |
| `desktop-notepad` / `desktop-paint` / `desktop-kline-chart` | 各应用偏好 |
| `desktop-calendar` | 日历按日备注 |
| `desktop-lock` | 锁屏会话（**不参与**备份导入导出） |
| `desktop-ai-chat` | 智聊偏好（含本机 API Key） |
| `desktop-wallpaper-boot` | 首屏壁纸同步标记 |

设置页「数据」分区可导出 / 导入 JSON 备份（`lib/storage/backup.ts`，格式标识 `mini-windows-desktop-backup`）。备份排除 `legacyDesktop` 与 `lock`。

### 服务端文件 `.data/`（已 gitignore）

开发与本机部署时，部分内容写在项目根 `.data/`：

```
.data/
  notes/          记事本
  drawings/       画图 PNG
  wallpapers/     上传壁纸
  ai-chat/        智聊会话
```

勿把 API Key、私钥等提交进仓库；`.env*` 亦已忽略。

---

## API 一览

| 路由 | 作用 |
| ---- | ---- |
| `POST/GET /api/notepad`、`/api/notepad/[id]` | 笔记列表与增删改 |
| `POST/GET /api/paint`、`/api/paint/[id]`、`/api/paint/file/[name]` | 画作元数据与文件 |
| `POST /api/wallpaper/upload`、`/api/wallpaper/import` | 壁纸上传 / 外链导入 |
| `GET /api/wallpaper/file/[name]` | 读取已上传壁纸 |
| `GET /api/music/search`、`/api/music/stream`、`/api/music/proxy` | Audius 搜索与流媒体代理 |
| `POST /api/chat`、相关 history | 智聊：代理 SiliconFlow 流式补全并落盘会话 |

**智聊：** 客户端在应用内填写 [SiliconFlow](https://siliconflow.cn/) API Key，经 `Authorization: Bearer` 传给 `/api/chat`；服务端默认模型为 `Qwen/Qwen2.5-7B-Instruct`。无需在 `.env` 中配置密钥（Key 存本机 store）。

**K 线：** 浏览器直连币安公开行情接口，无服务端密钥。

---

## 国际化与主题

- 语言：`zh-CN`（默认）、`en-US`；文案在 `messages/*.json`，cookie 键 `NEXT_LOCALE`。
- 主题：`next-themes` + CSS 变量；Tailwind `dark:` 跟随主题。
- 应用标题等与 `messages.apps`、`config/desktop` 的 BuiltinAppId 对齐。

---

## 更新日志怎么维护

**不要把「2026年7月21日」这类展示日期写进前端文案。**

1. 在 [`content/changelog.ts`](content/changelog.ts) 的 `CHANGELOG_DATES` **最前面**插入 ISO 日期（`YYYY-MM-DD`）
2. 在 `messages/zh-CN.json`、`messages/en-US.json` 的 `changelog.<date>` 下写 `title` 与 `items`
3. （可选）同步 [`CHANGELOG.md`](CHANGELOG.md)

应用内「日志」窗口与「文档 → 更新摘要」会用 `Intl.DateTimeFormat` 按当前语言格式化日期。

---

## 开发约定（简要）

- **新内置应用：** 在 `features/<name>` 实现 UI → `lib/desktop/window/apps.ts` 注册 `DesktopWindow` 子类 → `messages` 补 `apps.*` 文案 → 按需挂桌面图标 / 开始菜单（`showOnDesktop` / `showInStartMenu`）。
- **持久化：** 新 localStorage 字段先登记 `lib/storage/keys.ts`（及 schema），再接 Zustand `persist` + `appStorage.createStateStorage()`。
- **反馈：** 优先用全局 Toast / Modal，避免各应用自造提示层。
- **嵌入模式：** 多数应用支持 `embedded`（文件夹内打开等），外壳样式见 `lib/embeddedAppShell.ts`。

近期变更摘要见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## 说明

壁纸、音乐与演示文案仅供自娱与演示，请尊重版权。行情与第三方流媒体依赖公开接口，可用性与合规以各服务方条款为准。
