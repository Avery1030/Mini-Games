import type { NextConfig } from 'next'
// 引入next-intl插件
import createNextIntlPlugin from 'next-intl/plugin'

// 传入你的顶层i18n.ts路径（根目录的i18n.ts）
const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig: NextConfig = {
  /* 你原有配置保留 */
}

// 用插件包裹导出
export default withNextIntl(nextConfig)
