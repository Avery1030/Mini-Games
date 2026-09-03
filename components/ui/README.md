# `components/ui` — Win95 控件工具包

本目录是**无桌面业务**的复古 UI 层：不 import `@/store`、`@/lib/vfs`、`@/lib/desktop`、业务 i18n。公共导出面是 `index.ts`，抽离时整夹复制即可。

在本仓库里的对照页：桌面「文档」→「UI 组件」。交互示例见 `UiKitPreview.tsx`。

---

## 接入宿主

1. 复制 `components/ui`。
2. 根布局挂载一次：

```tsx
import { ModalHost, ToastHost, registerUiKvStorage } from '@/components/ui'

registerUiKvStorage(localStorage) // 或自己的 getItem/setItem
<>
  <App />
  <ModalHost labels={{ title: '提示', ok: '确定', cancel: '取消' }} />
  <ToastHost />
</>
```

3. 主题 token 用 CSS 变量（`--chrome`、`--chrome-light`、`--chrome-dark`、`--window-title-active` 等）。本项目写在 `app/globals.css`，抽离时一并带走或改写成库内默认主题。
4. 需要 `font-pixel` 或等价等宽/像素字体，立体边框才像 Win95。

`SplitPane` / `MasterDetail` 的宽度记忆走 `registerUiKvStorage`。不注册也能用，只是刷新后分栏宽度不保留。

---

## 立体铬（`theme.ts`）

| 导出 | 用途 |
| --- | --- |
| `winChrome` | 凸起可点控件（按钮默认态，含 hover/active） |
| `winChromePanel` | 凸起容器，无 hover（菜单、面板外壳） |
| `winChromePressed` | 按下 / 选中 |
| `winChromeSunken` | 凹陷（输入框、内容井） |

都是 Tailwind class 字符串，可直接 `cn(winChrome, className)`。

`cn()` 与项目根 `lib/cn` 相同：`clsx` + `tailwind-merge`。库内组件只用 `./cn`。

---

## 控件

### Button

立体按钮。`variant`: `raised`（默认）/ `pressed` / `title`（标题栏小按钮）。`size`: `sm` `md` `lg` `icon-sm` `icon` `icon-lg`。`loading` 时转圈并禁用；`active` 用于切换类高亮。其余透传到 `<button>`。

```tsx
<Button size="sm" onClick={onSave}>保存</Button>
<Button size="sm" variant="pressed">当前页</Button>
```

### Input

单行输入。`size`: `sm` `md`。`tone`: `chrome`（灰底控件）/ `field`（表单底）/ `dark`（深色窗内）。原生 `size` 被换成上述字面量。

### Select

自定义下拉（不是原生 `<select>`）。受控用 `value` + `onValueChange`；也可 `defaultValue`。`options: { value, label, disabled? }[]`。

### Checkbox / Switch

`Checkbox` 走原生 `checked` / `onChange`，可带 `label`。  
`Switch` 用 `checked` + `onCheckedChange`；`readOnly` 只展示、不渲染 input（避免嵌在按钮里出现双焦点）。

### Panel

凹陷分组。`padded` 默认 true；`inset` 换内容井底色。设置页、文档正文井都用它。

### Tab

深色内容区用的轻量 tab（高亮靠 `active`）。自己管选中态。

```tsx
<Tab active={tab === 'a'} onClick={() => setTab('a')}>A</Tab>
```

### Window

**只有铬**：标题栏、min/max/restore/close、八角缩放柄。位置、宽高、拖拽、吸附、zIndex 策略全由调用方用 `style` / 事件注入。

必填 `labels: { minimize, maximize, restore, close }`（无内置中文，方便多语言）。`onTitleMouseDown` / `onResizeMouseDown(edge)` 把指针事件交给宿主几何 hook。本项目封装在 `components/desktop/WindowsWindow.tsx`，不要把桌面 store 写进这个文件。

标题栏图标：`WinMinimizeIcon` `WinMaximizeIcon` `WinRestoreIcon` `WinCloseIcon`。

### ContextMenu

`menu: { x, y, items } | null`。`items` 可嵌套 `children`（向右展开子菜单）。`safeBottom` 避开任务栏。点空白 / Esc 调 `onClose`。

声明式菜单用 `resolveMenuItems(configs, ctx)`：`when` 控制是否出现，`disabled` 可以是函数。

### modal

全局层，须挂 `ModalHost`。

| API | 行为 |
| --- | --- |
| `modal.alert({ message, title? })` | Promise，一个确定 |
| `modal.confirm({ message, title? })` | Promise\<boolean\> |
| `modal.open({ title, content, actions })` | 自定义层，返回 id |
| `modal.close(id?)` / `modal.closeAll()` | 关一层 / 全关 |

按钮文案缺省时由 `ModalHost` 的 `labels` 填 `ok` / `cancel`。不要在控件里写死业务文案。

### toast

须挂 `ToastHost`。`toast.success / error / warning(message)`，或 `toast.show({ type, message, duration })`。`duration: false` 不自动关。同时最多 `TOAST_MAX` 条。

### SplitPane

左右分栏，中间细槽可拖；双击槽恢复 `defaultSize`；槽聚焦后方向键微调。`storageKey` 有值且已 `registerUiKvStorage` 时记住宽度。`children` 恰好两个。

### MasterDetail

桌面：内部就是 `SplitPane`。窄屏：列表 / 详情互斥，`detailOpen` + `onDetailOpenChange` 由调用方管（组件**不读** `window.matchMedia`，以免绑死断点）。`isMobile` 也由调用方传入。

---

## 不要放进本目录

| 位置 | 原因 |
| --- | --- |
| `components/desktop/*` | 图标层、任务栏、壁纸、锁屏，绑桌面 store |
| `store/*` `lib/vfs` `lib/desktop` | 窗口注册表、文件、几何 |
| `features/*` | 各应用业务 |

`UiKitPreview` 只用于本仓库对照，抽离 npm 包时可删，不必当公共 API。
