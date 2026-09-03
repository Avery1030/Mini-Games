# Avery Mini Windows Desktop

浏览器里的 Win95 风格**本机桌面**：窗口、文件和设置都留在这台机器上，没有账号。

你可以：用记事本 / 画图 / 表格把东西存在虚拟磁盘里；在「设置 → 数据」导出一份 JSON 带走（含文档）；或把 `components/ui` 的复古控件嵌进自己的页面（见「文档 → UI 组件」）。

桌面壳是容器，不是要替代真实操作系统。小游戏清单已冻结，不再往里加。

气质是「Win95 怀旧壳 + 一点当代网页」：系统偏好与窗口布局在 `localStorage`；**用户文件走 VFS（默认 IndexedDB）**；智聊会话在独立 IndexedDB。**内置应用按需动态加载**，首屏不打包全部 feature。

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

| 能力              | 说明                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------- |
| 桌面图标          | 内置应用 + 动态文件夹/文稿 + **VFS `/Desktop` 文件**；拖拽坐标记忆；右键新建 / 排列 / 回收站 |
| 文件夹 / 文本文档 | 运行时动态桌面项（`desktopItems`）；文本文档正文在 VFS `/Documents/*.txt`                    |
| VFS 桌面文件      | `/Desktop` 下列出的文件图标；图片双击打开查看器，`.txt` 打开记事本，代码文件打开代码编辑器 |
| 窗口              | 拖拽、缩放、最小化 / 最大化、叠放层级；小窗边缘软吸附；关闭后几何可记忆                      |
| 窗口路由          | 聚焦窗口同步地址栏 `/window/{应用}`；刷新可重开，浏览器后退 / 前进切换聚焦                   |
| 标签页标题        | `useDesktopDocumentTitle`：浏览器 `document.title` 跟随当前聚焦窗口；锁屏 / 无可见窗回落系统名 |
| 任务栏            | 开始菜单、已开窗口按钮与预览、时钟与日历备注、主题切换、语言切换                             |
| 锁屏              | 本机会话锁屏（密码不跨设备备份）                                                             |
| 反馈              | 全局 Modal、Toast（成功 / 失败 / 警告）                                                      |

### 内置应用

| 应用       | id                 | 说明                                                                       |
| ---------- | ------------------ | -------------------------------------------------------------------------- |
| 设置       | `settings`         | 显示（壁纸 / 3D 壁纸）、外观、任务栏、数据（一份 JSON 含偏好 + VFS 文件） |
| 文档       | `document`         | 应用说明、UI 组件预览、更新摘要                                           |
| 日志       | `log`              | 按日期查看更新记录                                                         |
| 记事本     | `notepad`          | 纯文本笔记 CRUD；内容在 VFS `/Documents`                                   |
| 代码编辑器 | `ide`              | 多窗口编辑 HTML / CSS / JS / TS / JSON；Prism、查找替换、Emmet、HTML 预览；会话可恢复 |
| 画图       | `paint`            | 画布、调色板、橡皮、形状；PNG 在 VFS `/Pictures/Drawings`                  |
| 计算器     | `calculator`       | 四则运算、括号、幂、开方与简单内存键；窗口不可缩放                         |
| 命令提示符 | `cmd`              | DOS 风格终端                                                               |
| 资源管理器 | `fileExplorer`     | 浏览 VFS 绝对路径；图片右键打开 / 设壁纸 / 复制移动 / 移入回收站           |
| 回收站     | `recycleBin`       | 桌面软删除项 + VFS `/Trash`；还原、永久删除、清空                          |
| 图片查看器 | `imageViewer`      | VFS `/Pictures` 图库；路径启动；URL 临时预览；删除走 `vfs.trash`           |
| K 线图表   | `klineChartViewer` | USDT 永续 / TradFi K 线（币安公开接口）、周期与指标              |
| 智聊       | `aiChat`           | SiliconFlow 流式对话；多会话独立 IDB；可导出 `.chat` 到 `/Documents/Chats` |
| 任务管理器 | `taskManager`      | 查看 / 强制关闭运行中窗口                                                  |
| 游戏       | `games`            | 游戏集合入口；清单已冻结，勿再新增                                         |
| 扫雷       | `minesweeper`      | 经典扫雷（经「游戏」打开）                                                 |
| 西瓜游戏   | `suika`            | 合成类小游戏                                                               |
| 图片拼图   | `imagePuzzle`      | 图片拼图                                                                   |
| 画布拼图   | `canvasJigsaw`     | Canvas 拼图                                                                |
| 推箱子     | `sokoban`          | 经典推箱子（关卡在 `features/games/sokoban/levels.ts`）                    |
| 数独       | `sudoku`           | 多难度、笔记 / 提示 / 设置，收录于「游戏」                                 |

小游戏收纳列表见 `features/games/ids.ts`（`GAME_APP_IDS`）。

---

## 技术栈

| 层     | 选型                                                                                  |
| ------ | ------------------------------------------------------------------------------------- |
| 框架   | Next.js 15（App Router）+ React 19 + TypeScript                                       |
| 样式   | Tailwind CSS 4、CSS 变量主题（配合 `next-themes`）                                    |
| 状态   | Zustand（`persist` → `localStorage`）                                                 |
| 文件   | 自研 VFS（`lib/vfs`，默认 IndexedDB 适配器）                                          |
| 国际化 | next-intl（`zh-CN` / `en-US` / `ja-JP`）                                              |
| 其它   | ahooks、date-fns、react-day-picker、klinecharts、prismjs、@tanstack/react-virtual、three、lucide-react |

---

## 虚拟文件系统（VFS）

用户产生的文件（笔记、画作、图片、壁纸、聊天导出等）**必须经 VFS API**，业务层禁止直连 IndexedDB / 云存储。

```
业务组件（窗口应用、资源管理器）
        ↓ 仅调用 vfs.*
VFS 核心（lib/vfs/vfs.ts）
        ↓ StorageAdapter
适配器（IdbAdapter；可扩展 R2 等）
```

### 路径约定（类 Unix 绝对路径）

| 路径                 | 用途                                 |
| -------------------- | ------------------------------------ |
| `/Desktop`           | 桌面可见文件                         |
| `/Documents`         | 记事本 `.txt`、代码编辑器源文件      |
| `/Documents/Chats`   | 智聊 `.chat` 导出                    |
| `/Pictures`          | 图片查看器图库                       |
| `/Pictures/Drawings` | 画图作品                             |
| `/Wallpapers`        | 自定义静态壁纸                       |
| `/Wallpapers/3d`     | 3D / GLB 壁纸                        |
| `/Trash`             | 系统隐藏回收站（bootstrap 自动创建） |

普通 `readDir('/')` **不列出** `/Trash`；回收站窗口直接 `readDir('/Trash')`。

### 对外 API（摘要）

```ts
vfs.readFile / writeFile
vfs.removeFile // 永久删除
vfs.renameFile / copyFile / moveFile
vfs.mkdir / readDir / exists
vfs.trash / restore / clearTrash // 软删除 ↔ /Trash
vfs.search / getTotalSize
vfs.allocateUniquePath / getNodeById / readFileById
```

Trash 内节点对外可带 `originalPath`、`trashedAt`。禁止对回收站内条目再次 `trash`；单项永久删除用 `removeFile`。

### 打开文件（避免循环依赖）

按路径打开应用的逻辑在 **`lib/desktop/openVfsFile.ts`**（不放进 `lib/vfs` 桶导出），避免 `vfs → store/window → registry` 环。图片查看器用 Zustand `store/imageViewer` 传递 `filePath`；代码编辑器用 `openIdeFile`（`lib/desktop/window/ideWindows.ts`）。

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
                  │
                  ▼
              lib/vfs（用户文件）
```

### 三层职责

| 层           | 位置                  | 存什么 / 做什么                                                                    |
| ------------ | --------------------- | ---------------------------------------------------------------------------------- |
| **定义层**   | `lib/desktop/window/` | `DesktopWindow` 子类：id、图标、默认宽高、`chrome`、React `app` 组件、生命周期钩子 |
| **注册层**   | `registry.ts`         | 内置单例 + 动态项（文件夹 / 文稿）；`useSyncExternalStore` 快照                    |
| **运行时层** | `store/window.ts` 等  | 可序列化状态：开合、zIndex、bounds、图标坐标、文件树；Zustand persist              |

**壳层分流：** `DesktopShell` 通过 `useIsMobileViewport()`（`<768px`）在 `MobileDesktop` 与 `WindowsDesktop` 之间切换；两端共用同一套 window / desktopItems store。

**原则：** 能 persist 的只放 Store；带 React 组件 / 行为多态的放 Class；列表给 UI 订阅时走 Registry 快照。用户文件走 VFS，系统配置不进 VFS。

### 关键数据流：双击图标 → 窗口出现

1. `DesktopIconsLayer` 双击 → 内置/动态项 `openWindow(id)`；VFS `/Desktop` 文件走 `openVfsFile(path)`
2. `openWindow` 先 `prefetchApp()` 开始拉应用 chunk，再设 `isOpen`
3. 图片：`useImageViewerStore.openFile(path)` + 打开 `imageViewer`
4. `DesktopWindowsLayer` 渲染 `WindowsWindow` + `<App embedded />`（`loadApp` 未就绪时 Suspense 占位）
5. 任务栏出现按钮；`useWindowRouteSync` 可选同步 `/window/[slug]`；`DesktopDocumentTitle` 同步浏览器标签页标题

### 应用懒加载与预取

内置应用 **统一在** `lib/desktop/window/builtins.ts` 注册，**不要**再为每个 feature 建 `register.ts`。

- **注册：** `{ id, icon, loadApp: () => import('@/features/...').then(m => m.X), ... }`
- **加载：** `defineApp.createDeferredApp` 用动态 `import` + `React.lazy`；`toDefinition` 读 `.app` 时不触发下载，真正挂载窗口才加载
- **预取：**
  - 桌面就绪后 `scheduleIdlePrefetchBuiltinApps()`（空闲分批，桌面可见 / 游戏优先，重应用靠后）
  - 悬停桌面图标、开始菜单项、手机 Dock / 主屏图标时 `prefetchApp()`
  - 打开「游戏」夹时 `prefetchApps(GAME_APP_IDS)`
- **已预取：** chunk 在缓存中则同步渲染，跳过 Suspense

### 循环依赖怎么破

`DesktopWindow` 不能直接 `import` store（store / registry / apps 会互相引用）。做法：

- `DesktopWindow.ts` 只依赖 `WindowController` **接口**
- `store/window` 初始化时 `registerWindowController(...)` 注入实现
- 类上的 `open()` / `close()` 经 `getController()` 委托
- feature 只通过 `loadApp` 的动态 `import()` 进入，避免 `registry ↔ store ↔ feature` 静态环
- **不要**从 `lib/vfs/index` 再导出会拉 `store/window` 的「打开文件」辅助；放在 `lib/desktop/`

### 窗口默认尺寸 vs 记忆尺寸

```
实际宽高 = runtime.bounds ?? builtins 里的 width/height ?? 兜底值
```

`useWindowGeometry` 用 `seedRef` **仅在挂载时**读一次。改默认高度后若本地已有该窗 `bounds`，需清该窗记忆或清站点存储后再开。

---

## 核心代码地图

### 目录总览

```
app/
  (desktop)/              桌面壳：/ 与 /window/[slug]
  api/                    Route Handlers（智聊、图片代理）
components/
  desktop/                桌面壳 UI（窗口层、任务栏、锁屏、开机…）
  desktop/mobile/         窄屏手机主屏
  ui/                     Win95 通用控件（抽离清单见 `components/ui/README.md`）
config/                   桌面类型与静态配置
features/                 各应用 UI 与业务（一应用一目录；注册见 builtins.ts）
hooks/desktop/            桌面交互 hooks
lib/
  vfs/                    VFS 核心 + IdbAdapter（用户文件唯一入口）
  desktop/                几何、吸附、路由、openVfsFile、vfsFileActions…
  desktop/window/         DesktopWindow / defineApp / registry / builtins / prefetchApps
  idb/                    仅 imageUtils / objectUrl / fetchRemote（无业务库）
  ai-chat/                智聊独立 IDB + .chat 文件
  wallpaper/              壁纸解析 / VFS API / boot
  storage/                localStorage key / schema / 备份
messages/                 zh-CN.json / en-US.json / ja-JP.json
store/                    Zustand stores（含 imageViewer、desktopVfs）
```

### 桌面壳（`components/desktop`）

| 文件                      | 职责                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| `DesktopShell.tsx`        | 等各 store `_hasHydrated` + 开机动画后再挂桌面；按断点分流；空闲预热应用 chunk；挂载 `DesktopDocumentTitle` |
| `WindowsDesktop.tsx`      | 编排图标层 / 窗口层 / 任务栏 / 拖放；右键清空回收站（桌面项 + VFS Trash） |
| `DesktopIconsLayer.tsx`   | 内置项 + desktopItems + VFS `/Desktop` 图标；双击打开；悬停预取           |
| `DesktopWindowsLayer.tsx` | 已开窗口列表                                                              |
| `WindowsWindow.tsx`       | 单窗 chrome、焦点盾、几何 / 最小化动画                                    |
| `DesktopTaskbar.tsx`      | 开始菜单、窗口按钮、时钟、主题 / 语言                                     |
| `FsDragLayer.tsx`         | 文件系统拖拽幽灵层                                                        |
| `Desktop3DWallpaper.tsx`  | three.js 3D 壁纸层                                                        |

### 窗口系统（`lib/desktop/window`）

| 文件                 | 职责                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| `DesktopWindow.ts`   | 抽象基类 + Controller 注入；`prefetchApp()` 钩子                      |
| `defineApp.ts`       | `registerBuiltinApp(s)`、`createDeferredApp`（dynamic import + lazy） |
| `builtins.ts`        | **唯一**内置应用注册表（元数据 + `loadApp`）                          |
| `prefetchApps.ts`    | 空闲分批预热、`prefetchApps(ids)`                                     |
| `apps.ts`            | 仅动态项：`FolderWindow` / `TextDocumentWindow`（同样懒加载）         |
| `ideWindows.ts`      | 代码编辑器 / HTML 预览多实例；会话写入 `desktop-ide-sessions`         |
| `registry.ts`        | 内置/动态窗口表、snapshot 订阅                                        |
| `createFolder.ts` 等 | 动态文件夹 / 文稿创建时同步 registry + stores                         |

相关：

| 文件                            | 职责                               |
| ------------------------------- | ---------------------------------- |
| `lib/desktop/openVfsFile.ts`    | 按路径打开查看器 / 代码编辑器 / 记事本 |
| `lib/desktop/vfsFileActions.ts` | 设壁纸、复制到 `/Desktop`          |
| `lib/desktop/itemsTree.ts`      | 桌面虚拟树（移动 / 软删除 / 重名） |

### Stores（`store`）

| Store              | 持久化 | 职责                                                       |
| ------------------ | ------ | ---------------------------------------------------------- |
| `window`           | ✅     | 窗口开合、zIndex、openOrder、bounds                        |
| `desktop`          | ✅     | 图标格点坐标（含 VFS 桌面文件 path 作 id）                 |
| `desktopItems`     | ✅     | 文件夹 / 文本文档软删除树；文稿软删时同步 `vfs.trash` 笔记 |
| `desktopVfs`       | ❌     | `/Desktop` 文件列表刷新                                    |
| `imageViewer`      | ❌     | 图片查看器 `filePath` 启动总线                             |
| `settings`         | ✅     | 壁纸路径 / fit / 3D、缩放、任务栏、屏保等                  |
| `lock`             | ✅     | 锁屏（**不参与**备份导出）                                 |
| `desktopSelection` | ❌     | 桌面多选                                                   |
| `fsDrag`           | ❌     | 跨层文件拖拽会话                                           |
| `notepad` 等       | ✅     | 各应用偏好                                                 |

### Features（摘录）

| 目录             | 备注                                                           |
| ---------------- | -------------------------------------------------------------- |
| `games/`         | 「游戏」夹 UI；收纳 id 列表 `ids.ts` → `GAME_APP_IDS`          |
| `sokoban/` 等    | 小游戏；关卡等大数据放 feature 内，随 `loadApp` 按需进包       |
| `file-explorer/` | VFS 目录浏览 + 图片右键菜单                                    |
| `image-viewer/`  | `/Pictures` 图库；`fetchImageByPath`；删除 `trashImageApi`     |
| `recycle-bin/`   | 合并桌面软删除根 + `/Trash`；去重已联动 trash 的笔记           |
| `notepad/`       | VFS `/Documents`；`pendingOpen` 支持站外打开                   |
| `ide/`           | 简易代码编辑器（textarea + Prism，无 Monaco）；Emmet 子集；HTML 预览窗口 |
| `paint/`         | VFS `/Pictures/Drawings`                                       |
| `ai-chat/`       | 多会话侧栏；独立 IDB `avery-mini-os-ai-chat`；请求不带历史全文 |
| `settings/`      | 壁纸上传/导入走 VFS `/Wallpapers`                              |

### 基础设施

| 文件                      | 职责                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `lib/vfs/*`               | 路径工具、错误类型、VFS 类、IdbAdapter                             |
| `lib/ai-chat/storage/*`   | 智聊 sessions / messages / meta                                    |
| `lib/ai-chat/chatFile.ts` | `.chat` ↔ VFS `/Documents/Chats`                                   |
| `lib/wallpaper/*`         | boot、resolve、vfsApi                                              |
| `lib/idb/*`               | 仅媒体辅助（缩略图、object URL、远程拉取），**无业务 objectStore** |
| `lib/http.ts`             | fetch 封装                                                         |
| `lib/websocket.ts`        | 心跳、退避重连                                                     |
| `lib/storage/backup.ts`   | 设置页 JSON 备份（v2 含 VFS 文件树；不含智聊 IDB / lock）          |

---

## 常见维护任务

### 新增内置应用（清单）

1. 在 `features/<name>/` 实现 UI（建议支持 `embedded`）
2. 在 `lib/desktop/window/builtins.ts` 追加一条配置，**必须**用 `loadApp`，不要静态 `import` feature：

```ts
{
  id: 'myApp',
  icon: SomeIcon,
  defaultCoordinate: [0, 0],
  width: 480,
  height: 360,
  loadApp: () => import('@/features/my-app').then((m) => m.MyApp),
}
```

3. 应用显示名写在 `messages.*.apps.<id>`
4. 按需：`showOnDesktop` / `showInStartMenu`；手机 Dock 改 `MOBILE_DOCK_APP_IDS`。**不要**再往 `GAME_APP_IDS` 加新游戏（清单已冻结）。
5. 若有新 localStorage：先改 `lib/storage/keys.ts` + schema，再写 store
6. 若读写用户文件：**只调 `vfs.*`**，不要新建业务 IDB store

**易翻车点：** 在 `builtins.ts` 顶层静态 import feature 会拖垮首屏 / 造成循环依赖；打开文件辅助勿挂进 `lib/vfs` 桶；改默认尺寸被旧 `bounds` 盖住。

### 改持久化 / 修「刷新错乱」

1. 看对应 store 的 `version` / `migrate` / `partialize`
2. 确认 `DesktopShell` 是否等 `_hasHydrated` 再挂桌面
3. 壁纸首屏：`lib/wallpaper/boot.ts` + `desktop-wallpaper-boot`

### 更新日志怎么写

1. 在 `[content/changelog.ts](content/changelog.ts)` 的 `CHANGELOG_DATES` **最前面**插入 ISO 日期（`YYYY-MM-DD`）
2. 在 `messages` 的 `changelog.<date>` 下写 `title` 与 `items`
3. （可选）同步 `[CHANGELOG.md](CHANGELOG.md)`

---

## 路由与中间件

| 路径             | 含义                           |
| ---------------- | ------------------------------ |
| `/`              | 桌面根视图                     |
| `/window/[slug]` | 聚焦指定应用窗口               |
| `/api/*`         | 服务端 API（不经 intl 重定向） |

`middleware.ts`：桌面壳路径（`/`、`/window/*`）绕过 next-intl；其余走 intl。

---

## 数据与持久化

### 分层原则

| 类别                           | 存储位置                                                |
| ------------------------------ | ------------------------------------------------------- |
| 主题、语言、窗口布局、图标坐标 | `localStorage`（`lib/storage`）                         |
| 用户文件（笔记 / 图 / 壁纸…）  | **VFS** → `avery-mini-os-vfs`（fileMeta / fileContent） |
| 智聊会话与消息                 | 独立 IDB `avery-mini-os-ai-chat`                        |
| 锁屏会话                       | `localStorage`（不参与备份）                            |

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
| `desktop-ide-sessions`                                      | 代码编辑器窗口会话（路径 / 标题） |
| `desktop-wallpaper-boot`                                    | 首屏壁纸同步标记                  |

备份：设置页 → `lib/storage/backup.ts`（v2 含 VFS 文本文件）。**不含**智聊 IDB 与锁屏。图片等二进制仍在本机 IndexedDB。

### 环境变量

| 变量                  | 用途                                                |
| --------------------- | --------------------------------------------------- |
| `SILICONFLOW_API_KEY` | 智聊 SiliconFlow Key（仅服务端，见 `.env.example`） |

---

## API 一览

| 路由                    | 作用                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `POST /api/chat`        | 智聊：代理 SiliconFlow 流式补全（仅当前 `content`，不带历史全文） |
| `POST /api/proxy-image` | 外链图片 CORS 代理（体积限制，防 SSRF 需持续收紧）                |

**K 线：** 浏览器直连币安公开接口，无服务端密钥。

---

## 国际化与主题

- 语言：`zh-CN`（默认）、`en-US`、`ja-JP`；cookie 键 `NEXT_LOCALE`；`localePrefix: 'never'`
- 主题：`next-themes` + CSS 变量；Tailwind `dark:` 跟随
- 应用标题与 `messages.apps`、`BuiltinAppId` 对齐；动态项优先用运行时 `title`

---

## 开发约定

- **用户文件：** 一律 `vfs.*`；禁止业务组件直接操作 IndexedDB
- **反馈：** 优先全局 Toast / Modal
- **嵌入：** `embedded` 时用 `embeddedAppShell`
- **订阅粒度：** 能分层订 store 就不要在 `WindowsDesktop` 顶层一把梭
- **类型：** 可序列化 runtime 与 React 组件类型分开；禁止 `any`

近期变更摘要见 `[CHANGELOG.md](CHANGELOG.md)`。

---

## 说明

壁纸与演示文案仅供自娱与演示，请尊重版权。行情依赖公开接口，可用性与合规以各服务方条款为准。
