import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'
import { locales, defaultLocale } from './config'

export const routing = defineRouting({
  locales,
  defaultLocale,
  // 关键配置：URL完全不携带语言标识
  localePrefix: 'never',
  // 统一Cookie配置
  localeCookie: {
    path: '/',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
  },
})

// 导出路由工具，用于切换语言
export const { Link, useRouter, usePathname, redirect } = createNavigation(routing)
