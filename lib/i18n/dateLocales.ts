import type { Locale } from '@/i18n/config'
import { enUS as enUSDay, zhCN as zhCNDay, zhTW as zhTWDay, ja as jaDay, ru as ruDay, de as deDay, fr as frDay } from 'react-day-picker/locale'
import {
  enUS as enUSDateFns,
  zhCN as zhCNDateFns,
  zhTW as zhTWDateFns,
  ja as jaDateFns,
  ru as ruDateFns,
  de as deDateFns,
  fr as frDateFns,
} from 'date-fns/locale'

/** Intl / toLocale* 使用的 BCP 47 标签（与 Locale 相同） */
export function intlLocale(locale: string): string {
  return locale || 'zh-CN'
}

export function dayPickerLocale(locale: string) {
  switch (locale as Locale) {
    case 'zh-CN':
      return zhCNDay
    case 'zh-TW':
      return zhTWDay
    case 'ja-JP':
      return jaDay
    case 'ru-RU':
      return ruDay
    case 'de-DE':
      return deDay
    case 'fr-FR':
      return frDay
    case 'en-US':
    default:
      return enUSDay
  }
}

export function dateFnsLocale(locale: string) {
  switch (locale as Locale) {
    case 'zh-CN':
      return zhCNDateFns
    case 'zh-TW':
      return zhTWDateFns
    case 'ja-JP':
      return jaDateFns
    case 'ru-RU':
      return ruDateFns
    case 'de-DE':
      return deDateFns
    case 'fr-FR':
      return frDateFns
    case 'en-US':
    default:
      return enUSDateFns
  }
}
