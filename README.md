# Avery Mini-App

Windows 95 风格的 Web 桌面：内置设置、文档、音乐与小游戏。

## 开发

```bash
yarn dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 目录结构

```
app/                 Next.js 路由、布局与 API
features/            桌面应用（设置 / 文档 / 记事本 / 画图 / 音乐 / 游戏…）
components/
  desktop/           桌面壳（窗口、任务栏、主题/语言）
  ui/                通用 Win95 控件
config/              桌面图标与壁纸等静态配置
hooks/desktop/       桌面交互 hooks
lib/                 工具库（按 desktop / wallpaper / music 分域）
store/               Zustand 状态
i18n/ + messages/    国际化
```

路径别名：`@/` → 项目根目录。
