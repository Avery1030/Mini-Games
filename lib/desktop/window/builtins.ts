/**
 * 内置应用注册入口。清单在 config/apps.ts。
 */
import { BUILTIN_APPS } from '@/config/apps'
import { registerBuiltinApps } from './defineApp'

registerBuiltinApps(BUILTIN_APPS)
