# Avery Mini Windows Desktop

Windows 95 风格的 Web 桌面（Next.js App Router）：可拖拽图标与窗口、任务栏、开始菜单、锁屏，以及一整套内置应用——设置、文档、日志、记事本、画图、计算器、命令提示符、回收站、K 线图表、智聊、任务管理器，外加扫雷与俄罗斯方块。

气质是「Win95 怀旧壳 + 一点当代网页」：视觉走经典对话框质感，偏好在 `localStorage`，笔记 / 画作 / 壁纸 / 会话等内容在浏览器 **IndexedDB**，不依赖账号体系。

---

## 快速开始

**环境要求：** Node.js 20+（建议与 Next.js 15 对齐）、包管理器任选 yarn / npm / pnpm。

```bash
# 安装依赖
yarn

# 配置智聊 API Key（可选，不配则智聊不可用）
cp .env.example .env.local

# 开发（Turbopack）
yarn dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

```bash
yarn build   # 生产构建
yarn start   # 启动生产服务
yarn lint    # ESLint
```

路径别名：`@/` → 项目根目录。

---

## 功能概览

### 桌面壳

| 能力              | 说明                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| 桌面图标          | 拖拽与坐标记忆；右键菜单（新建文件夹 / 文本文档、排列图标、刷新、移至回收站等） |
| 文件夹 / 文本文档 | 运行时动态桌面项，可嵌套、重命名；文本文档关联记事本数据                        |
| 窗口              | 拖拽、缩放、最小化 / 最大化、叠放层级；小窗边缘软吸附；关闭后几何可记忆         |
| 窗口路由          | 聚焦窗口同步地址栏 `/window/{应用}`；刷新可重开，浏览器后退 / 前进切换聚焦      |
| 任务栏            | 开始菜单、已开窗口按钮与预览、时钟与日历备注、主题切换、语言切换                |
| 锁屏              | 本机会话锁屏（密码不跨设备备份）                                                |
| 反馈              | 全局 Modal、Toast（成功 / 失败 / 警告）                                         |

### 内置应用

| 应用       | id                 | 说明                                                             |
| ---------- | ------------------ | ---------------------------------------------------------------- |
| 设置       | `settings`         | 显示（壁纸上传 / 导入）、外观、任务栏、数据（JSON 备份导入导出） |
| 文档       | `document`         | 应用说明与更新摘要（纯前端文案）                                 |
| 日志       | `log`              | 按日期查看更新记录                                               |
| 记事本     | `notepad`          | 纯文本笔记 CRUD；内容存 IndexedDB                                |
| 画图       | `paint`            | 画布、调色板、橡皮、形状；PNG 存 IndexedDB                       |
| 计算器     | `calculator`       | 四则运算、括号、幂、开方与简单内存键；窗口不可缩放               |
| 命令提示符 | `cmd`              | DOS 风格终端                                                     |
| 回收站     | `recycleBin`       | 软删除桌面资源的恢复与清空                                       |
| K 线图表   | `klineChartViewer` | USDT 永续 / TradFi K 线（币安公开接口）、周期与指标、画线工具    |
| 智聊       | `aiChat`           | SiliconFlow 流式对话；会话存 IndexedDB                           |
| 图片查看器 | `imageViewer`      | 本地上传 / URL 导入；图片存 IndexedDB                            |
| 任务管理器 | `taskManager`      | 查看 / 强制关闭运行中窗口                                        |
| 扫雷       | `minesweeper`      | 经典扫雷                                                         |
| 俄罗斯方块 | `tetris`           | 经典俄罗斯方块                                                   |

---

## 技术栈

| 层     | 选型                                                                           |
| ------ | ------------------------------------------------------------------------------ |
| 框架   | Next.js 15（App Router）+ React 19 + TypeScript                                |
| 样式   | Tailwind CSS 4、CSS 变量主题（配合 `next-themes`）                             |
| 状态   | Zustand（`persist` → `localStorage`）                                          |
| 国际化 | next-intl（`zh-CN` / `en-US`）                                                 |
| 其它   | date-fns、react-day-picker、klinecharts、@tanstack/react-virtual、lucide-react |

---

## 核心架构（维护必读）

桌面不是「按路由切页」，而是 **常驻工作区 + 多窗口叠放**。理解下面三层，改窗口 / 图标 / 应用时不容易改错地方。

```
┌─────────────────────────────────────────────────────────────┐
│  app/(desktop)  →  DesktopPage  →  DesktopShell             │
│       开机 / 水合就绪后挂载 WindowsDesktop                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
 DesktopIconsLayer   DesktopWindowsLayer   DesktopTaskbar
 （图标+框选+拖放）    （已开窗口+几何）      （开始菜单+按钮）
        │                   │                   │
        └─────────┬─────────┴─────────┬─────────┘
                  ▼                   ▼
         Zustand stores      lib/desktop/window
         (可序列化运行时)     (定义 / 注册表 / 行为)
```

### 三层职责

| 层           | 位置                  | 存什么 / 做什么                                                                    |
| ------------ | --------------------- | ---------------------------------------------------------------------------------- |
| **定义层**   | `lib/desktop/window/` | `DesktopWindow` 子类：id、图标、默认宽高、`chrome`、React `app` 组件、生命周期钩子 |
| **注册层**   | `registry.ts`         | 内置单例 + 动态项（文件夹 / 文稿）；`useSyncExternalStore` 快照                    |
| **运行时层** | `store/window.ts` 等  | 可序列化状态：开合、zIndex、bounds、图标坐标、文件树；Zustand persist              |

**原则：** 能 persist 的只放 Store；带 React 组件 / 行为多态的放 Class；列表给 UI 订阅时走 Registry 快照，不要在组件里手搓「应用列表常量」。

### 关键数据流：双击图标 → 窗口出现

1. `DesktopIconsLayer` / `DesktopIcon` 双击 → `openWindow(id)` 或 `DesktopWindow.open()`
2. `store/window`：确保槽位、`isOpen`、抬 `zIndex`、设 `active`、分配 `openOrder`、带上记忆 `bounds`
3. `DesktopWindowsLayer` 订阅合并视图（定义 + runtime），渲染 `WindowsWindow` + `<App embedded />`
4. 任务栏出现按钮；`useWindowRouteSync` 可选同步 `/window/[slug]`

### 循环依赖怎么破

`DesktopWindow` 不能直接 `import` store（store / registry / apps 会互相引用）。做法：

- `DesktopWindow.ts` 只依赖 `WindowController` **接口**
- `store/window` 初始化时 `registerWindowController(...)` 注入实现
- 类上的 `open()` / `close()` 经 `getController()` 委托

部分重依赖应用（Cmd、Folder、K 线）在 `apps.ts` 用 **getter + lazy** `require` 推迟加载 feature，避免静态环。

### 窗口默认尺寸 vs 记忆尺寸

```
实际宽高 = runtime.bounds ?? apps.ts 的 width/height ?? 兜底值
```

`useWindowGeometry` 用 `seedRef` **仅在挂载时**读一次。因此改 `apps.ts` 默认高度后，若本地已有该窗 `bounds`，看起来会「不生效」——清该窗记忆或清站点存储后再开即可。计算器等固定窗通过覆盖 `chrome.resizable / maximizable` 禁止缩放。

---

## 核心代码地图

### 目录总览

```
app/
  (desktop)/              桌面壳：/ 与 /window/[slug]
  api/                    Route Handlers（智聊、图片代理）
components/
  desktop/                桌面壳 UI（窗口层、任务栏、锁屏、开机…）
  ui/                     Win95 通用控件（Button / Modal / Toast / SplitPane…）
config/                   桌面类型与静态配置（DesktopAppId、WindowBounds…）
features/                 各应用 UI 与业务（一应用一目录）
hooks/desktop/            桌面交互 hooks
lib/
  desktop/                几何、吸附、路由、文件树、框选…
  desktop/window/         DesktopWindow / apps / registry（核心）
  idb/                    IndexedDB 封装
  storage/                localStorage key / schema / 备份 / 迁移
  websocket.ts / http.ts  网络基础设施
messages/                 zh-CN.json / en-US.json
store/                    Zustand stores
docs/                     补充文档（如前端面试题）
```

### 桌面壳（`components/desktop`）

| 文件                      | 职责                                                            |
| ------------------------- | --------------------------------------------------------------- |
| `DesktopShell.tsx`        | 等各 store `_hasHydrated` + 开机动画后再挂桌面，防 SSR / 闪烁   |
| `WindowsDesktop.tsx`      | 编排图标层 / 窗口层 / 任务栏 / 拖放幽灵层等（各层独立订 store） |
| `DesktopIconsLayer.tsx`   | 图标渲染、框选、右键、打开                                      |
| `DesktopWindowsLayer.tsx` | 已开窗口列表；合并 `bounds` 与默认宽高后交给 `WindowsWindow`    |
| `WindowsWindow.tsx`       | 单窗 chrome、焦点盾、对接几何 / 最小化动画 hooks                |
| `DesktopTaskbar.tsx`      | 开始菜单、窗口按钮、时钟、主题 / 语言                           |
| `FsDragLayer.tsx`         | 文件系统拖拽幽灵层（`elementsFromPoint` 探测 drop）             |

### 窗口系统（`lib/desktop/window`）

| 文件                 | 职责                                                  |
| -------------------- | ----------------------------------------------------- |
| `DesktopWindow.ts`   | 抽象基类 + Controller 注入                            |
| `apps.ts`            | 所有内置 `*Window` 子类（改默认尺寸 / chrome 看这里） |
| `registry.ts`        | `BUILTIN_WINDOWS`、动态注册、snapshot 订阅            |
| `createFolder.ts` 等 | 动态文件夹 / 文稿创建时同步 registry + stores         |

相关几何与交互：

| 文件                                   | 职责                                         |
| -------------------------------------- | -------------------------------------------- |
| `lib/desktop/windowGeometry.ts`        | 工作区尺寸、`createWindowSeed`、resize 常量  |
| `lib/desktop/windowSnap.ts`            | 边缘 / 他窗软吸附（threshold + escape 迟滞） |
| `lib/desktop/cascade.ts`               | 无记忆位置时的级联开窗                       |
| `lib/desktop/windowRoute.ts`           | `DesktopAppId` ↔ `/window/[slug]`            |
| `lib/desktop/dockPose.ts`              | 最小化飞向任务栏的目标位姿                   |
| `lib/desktop/layout.ts`                | 图标网格坐标 ↔ 像素                          |
| `lib/desktop/itemsTree.ts`             | 虚拟文件树（移动 / 回收站 / 重名）           |
| `lib/desktop/marquee.ts` / `fsDrop.ts` | 框选命中、drop 目标属性                      |

### Hooks（`hooks/desktop`）

| Hook                 | 职责                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `useDesktopApps`     | 合并 registry + window + coordinates；`useWindowsIgnoringOpenOrder` 避免任务栏排序拖垮窗口层 |
| `useWindowGeometry`  | 拖拽 / 八向缩放 / 最大化记忆                                                                 |
| `useWindowDockAnim`  | 最小化 / 还原动画                                                                            |
| `useWindowRouteSync` | URL ↔ 聚焦窗（防 push/pop 反馈环）                                                           |
| `useMarqueeSelect`   | 空白处框选（回调用 ref，避免重绑 `window` 监听）                                             |
| `useDesktopIconDrag` | 图标拖拽落格、Alt 复制                                                                       |
| `useTaskbarReorder`  | 任务栏按钮排序（只改 `openOrder`）                                                           |
| `useIdleTimeout`     | 屏保触发                                                                                     |
| `useApplyUiScale`    | CSS 变量 UI 缩放                                                                             |

### Stores（`store`）

| Store                                           | 持久化 | 职责                                                                      |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `window`                                        | ✅     | 窗口开合、zIndex、openOrder、bounds、「显示桌面」快照（快照不入 persist） |
| `desktop`                                       | ✅     | 图标格点坐标                                                              |
| `desktopItems`                                  | ✅     | 文件夹 / 文本文档 / 回收站树                                              |
| `settings`                                      | ✅     | 壁纸、缩放、任务栏、屏保等（注意 version migrate）                        |
| `lock`                                          | ✅     | 锁屏（**不参与**备份导出）                                                |
| `desktopSelection`                              | ❌     | 桌面多选（瞬时）                                                          |
| `fsDrag`                                        | ❌     | 跨层文件拖拽会话                                                          |
| `notepad` / `paint` / `klineChart` / `calendar` | ✅     | 各应用偏好                                                                |

持久化统一走 `lib/storage`（`STORAGE_KEYS` + `appStorage.createStateStorage()`）。新字段先登记 key / schema，再接 `persist`。

### Features（`features/<name>`）

每个应用一个目录，入口通常是 `index.tsx`，经对应 `*Window.app` 挂到窗口内容区。支持 `embedded?: boolean`（文件夹内打开等），外壳样式见 `lib/embeddedAppShell.ts`（嵌入时用 `h-full`，避免写死 `min-h` 卡住最大化）。

| 目录                          | 备注                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `KlineChartViewer/`           | REST + WS（`binance.ts`）；`contractType` 按交易对区分 `PERPETUAL` / `TRADIFI_PERPETUAL` |
| `ai-chat/`                    | 客户端 SSE 解析；服务端 `app/api/chat` 代理                                              |
| `calculator/`                 | 手写表达式解析（不用 `eval`）                                                            |
| `cmd/`                        | 命令直接调 store / openWindow                                                            |
| `notepad/` / `text-document/` | 内容走 `lib/idb/notes`                                                                   |
| `paint/`                      | 画布 + IDB drawings                                                                      |
| `settings/sections/`          | 设置分页签                                                                               |

### 基础设施

| 文件                            | 职责                                                |
| ------------------------------- | --------------------------------------------------- |
| `lib/http.ts`                   | fetch 封装（超时 Abort、json/stream/blob）          |
| `lib/websocket.ts`              | 心跳看门狗、退避重连、发送队列、visibility / online |
| `hooks/useWebSocket.ts`         | WS 的 React 封装（回调进 ref）                      |
| `lib/idb/db.ts`                 | IDB 单例（库名 `avery-mini-os`）                    |
| `lib/storage/backup.ts`         | 设置页 JSON 备份（不含 IDB 与 lock）                |
| `lib/winChrome.ts`              | Win95 立体边框工具类                                |
| `components/ui/modal` / `toast` | 命令式 `modal.confirm` / `toast.success`            |

---

## 常见维护任务

### 新增内置应用（清单）

1. 在 `features/<name>/` 实现 UI（建议支持 `embedded`）
2. 在 `lib/desktop/window/apps.ts` 新增 `XxxWindow extends DesktopWindow`（id、icon、宽高、chrome、app）
3. 把实例加入 `registry.ts` 的 `BUILTIN_WINDOWS`
4. 若 id 是新字面量：更新 `config/desktop.ts` 的 `BuiltinAppId`
5. `messages/zh-CN.json` 与 `en-US.json` 补 `apps.<id>`
6. 按需：`showOnDesktop` / `showInStartMenu`；路由 slug 与 id 一致即可
7. 若有新 localStorage：先改 `lib/storage/keys.ts` + schema，再写 store

**易翻车点：** 忘双语文案；静态 import 造成循环依赖（改用 lazy require）；改默认尺寸却被旧 `bounds` 盖住。

### 改窗口交互 / 性能

- 拖拽缩放：`useWindowGeometry` + `windowGeometry.ts`
- 吸附手感：`windowSnap.ts` 的 `WINDOW_SNAP_THRESHOLD` / `WINDOW_SNAP_ESCAPE`
- 任务栏排序导致窗口狂刷：窗口层必须继续忽略 `openOrder`（见 `useDesktopApps.ts`）
- 长期 `window` 监听 + 父组件回调：用 ref 存最新回调（参考 `useMarqueeSelect`），勿把不稳定函数塞进 effect 依赖

### 改持久化 / 修「刷新错乱」

1. 看对应 store 的 `version` / `migrate` / `partialize`
2. 确认 `DesktopShell` 是否等 `_hasHydrated` 再挂桌面
3. 壁纸首屏：`lib/wallpaper/boot.ts` + `desktop-wallpaper-boot`
4. Legacy：`lib/storage/migrateLegacy.ts` / `store/migrateLegacy.ts`

### 更新日志怎么写

**不要把「2026年7月21日」这类展示日期写进前端文案。**

1. 在 `[content/changelog.ts](content/changelog.ts)` 的 `CHANGELOG_DATES` **最前面**插入 ISO 日期（`YYYY-MM-DD`）
2. 在 `messages/zh-CN.json`、`messages/en-US.json` 的 `changelog.<date>` 下写 `title` 与 `items`
3. （可选）同步 `[CHANGELOG.md](CHANGELOG.md)`

---

## 路由与中间件

| 路径             | 含义                           |
| ---------------- | ------------------------------ |
| `/`              | 桌面根视图                     |
| `/window/[slug]` | 聚焦指定应用窗口               |
| `/api/*`         | 服务端 API（不经 intl 重定向） |

`middleware.ts`：桌面壳路径（`/`、`/window/*`）绕过 next-intl；其余走 intl。

聚焦窗由客户端 `history.pushState` / `replaceState` 同步（`lib/desktop/windowRoute.ts` + `useWindowRouteSync`）。

---

## 数据与持久化

### localStorage（`lib/storage`）

| Key                                                         | 用途                              |
| ----------------------------------------------------------- | --------------------------------- |
| `app-theme`                                                 | 明 / 暗主题                       |
| `desktop-settings`                                          | 壁纸、图标尺寸、UI 缩放、任务栏等 |
| `desktop-windows`                                           | 窗口开合、几何、zIndex            |
| `desktop-coordinates`                                       | 图标格点坐标                      |
| `desktop-items`                                             | 动态文件夹 / 文本文档等           |
| `desktop-notepad` / `desktop-paint` / `desktop-kline-chart` | 应用偏好                          |
| `desktop-calendar`                                          | 日历备注                          |
| `desktop-lock`                                              | 锁屏会话（**不参与**备份）        |
| `desktop-wallpaper-boot`                                    | 首屏壁纸同步标记                  |

备份：设置页 → `lib/storage/backup.ts`（标识 `mini-windows-desktop-backup`）。**不含** IndexedDB 内容。

### IndexedDB（`avery-mini-os`）

| Store        | 用途       |
| ------------ | ---------- |
| `notes`      | 记事本     |
| `drawings`   | 画图 PNG   |
| `wallpapers` | 自定义壁纸 |
| `images`     | 图片查看器 |
| `ai-chat`    | 智聊会话   |

### 环境变量

| 变量                  | 用途                                                |
| --------------------- | --------------------------------------------------- |
| `SILICONFLOW_API_KEY` | 智聊 SiliconFlow Key（仅服务端，见 `.env.example`） |

---

## API 一览

| 路由                    | 作用                                               |
| ----------------------- | -------------------------------------------------- |
| `POST /api/chat`        | 智聊：代理 SiliconFlow 流式补全                    |
| `POST /api/proxy-image` | 外链图片 CORS 代理（体积限制，防 SSRF 需持续收紧） |

**K 线：** 浏览器直连币安公开接口，无服务端密钥。

---

## 国际化与主题

- 语言：`zh-CN`（默认）、`en-US`；cookie 键 `NEXT_LOCALE`；`localePrefix: 'never'`
- 主题：`next-themes` + CSS 变量；Tailwind `dark:` 跟随
- 应用标题与 `messages.apps`、`BuiltinAppId` 对齐；动态项优先用运行时 `title`

---

## 开发约定

- **反馈：** 优先全局 Toast / Modal，避免各应用自造提示层
- **嵌入：** `embedded` 时用 `embeddedAppShell`，靠窗口壳的 flex 高度撑满
- **订阅粒度：** 能分层订 store 就不要在 `WindowsDesktop` 顶层一把梭再往下传
- **类型：** 可序列化 runtime 与 React 组件类型分开；动态 id 用 `DesktopAppId` 扩展，不要满地 `string`

近期变更摘要见 `[CHANGELOG.md](CHANGELOG.md)`。

---

## 说明

壁纸与演示文案仅供自娱与演示，请尊重版权。行情依赖公开接口，可用性与合规以各服务方条款为准。
