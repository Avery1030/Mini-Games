import type { Locale } from '@/i18n/config'
import { enUS as enUSDay, zhCN as zhCNDay, ja as jaDay } from 'react-day-picker/locale'
import {
  enUS as enUSDateFns,
  zhCN as zhCNDateFns,
  ja as jaDateFns,
} from 'date-fns/locale'

/** Intl / toLocale* 使用的 BCP 47 标签（与 Locale 相同） */
export function intlLocale(locale: string): string {
  return locale || 'zh-CN'
}

export function dayPickerLocale(locale: string) {
  switch (locale as Locale) {
    case 'zh-CN':
      return zhCNDay
    case 'ja-JP':
      return jaDay
    case 'en-US':
    default:
      return enUSDay
  }
}

export function dateFnsLocale(locale: string) {
  switch (locale as Locale) {
    case 'zh-CN':
      return zhCNDateFns
    case 'ja-JP':
      return jaDateFns
    case 'en-US':
    default:
      return enUSDateFns
  }
}
