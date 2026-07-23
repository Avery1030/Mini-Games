# Avery Mini Windows Desktop

Windows 95 风格的 Web 桌面（Next.js）：可拖拽图标与窗口、任务栏、开始菜单，以及设置、文档、日志、记事本、画图、音乐、计算器与小游戏。

## 快速开始

```bash
# 安装依赖（yarn / npm / pnpm 均可）
yarn

# 开发
yarn dev
```

打开 [http://localhost:3000](http://localhost:3000)。

```bash
yarn build   # 生产构建
yarn start   # 启动生产服务
yarn lint    # ESLint
```

## 功能概览

| 区域   | 说明                                                               |
| ------ | ------------------------------------------------------------------ |
| 桌面   | 图标拖拽与坐标记忆、右键菜单（新建文件夹 / 排列图标 / 刷新）、壁纸 |
| 窗口   | 拖拽、缩放、最小化/最大化、边缘软吸附（小窗）                      |
| 任务栏 | 开始菜单、已开窗口、时钟日历、主题与语言                           |
| 应用   | 设置、文档、日志、记事本、画图、音乐、计算器、扫雷、俄罗斯方块     |
| 反馈   | 全局 Modal、Toast（成功/失败/警告）                                |

本地数据（笔记、画作、壁纸文件等）写在项目下的 `.data/`（勿提交密钥类内容）。

## 目录结构

```
app/                 Next.js 路由、布局与 API
content/             内容清单（如 changelog 日期列表）
features/            桌面应用（设置 / 文档 / 日志 / 记事本 / 画图 / 音乐 / 游戏…）
components/
  desktop/           桌面壳（窗口、任务栏、锁屏…）
  ui/                通用 Win95 控件（含 modal / toast）
config/              桌面与壁纸等静态配置
hooks/desktop/       桌面交互 hooks
lib/                 工具库（desktop / wallpaper / music / storage…）
store/               Zustand 状态
messages/            中英文文案（next-intl）
CHANGELOG.md         面向仓库的更新说明
```

路径别名：`@/` → 项目根目录。

## 更新日志怎么维护

**不要把「2026年7月21日」这类展示日期写进前端文案。**

1. 在 [`content/changelog.ts`](content/changelog.ts) 的 `CHANGELOG_DATES` 最前插入 ISO 日期（`YYYY-MM-DD`）
2. 在 `messages/zh-CN.json`、`messages/en-US.json` 的 `changelog.<date>` 下写 `title` 与 `items`
3. （可选）同步 [`CHANGELOG.md`](CHANGELOG.md)

应用内「日志」窗口与「文档 → 更新摘要」会用 `Intl.DateTimeFormat` 按当前语言格式化日期。

## 技术栈

- Next.js 15（App Router）+ React 19
- next-intl、next-themes、Zustand、Tailwind CSS 4

## 说明

壁纸、音乐与演示文案仅供自娱与演示，请尊重版权。
