import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { z } from 'zod'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import { hashLockPassword, verifyLockPassword } from '@/lib/lockPassword'

const LockPersistSchema = z.object({
  isLocked: z.unknown().optional(),
  sessionHash: z.unknown().optional(),
})

interface LockState {
  isLocked: boolean
  /** 本次锁屏的临时密码哈希；解锁后清空 */
  sessionHash: Nullable<string>
  _hasHydrated: boolean
}

interface LockActions {
  setHasHydrated: (value: boolean) => void
  /** 用本次临时密码进入锁屏 */
  lockWithPassword: (password: string) => Promise<boolean>
  unlock: (password: string) => Promise<boolean>
}

export type LockStore = LockState & LockActions

export const useLockStore = create<LockStore>()(
  persist(
    (set, get) => ({
      isLocked: false,
      sessionHash: null,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      lockWithPassword: async (password) => {
        const trimmed = password.trim()
        if (!trimmed) return false
        const sessionHash = await hashLockPassword(trimmed)
        set({ isLocked: true, sessionHash })
        return true
      },

      unlock: async (password) => {
        const { sessionHash } = get()
        if (!sessionHash) {
          set({ isLocked: false, sessionHash: null })
          return true
        }
        const ok = await verifyLockPassword(password, sessionHash)
        if (ok) set({ isLocked: false, sessionHash: null })
        return ok
      },
    }),
    {
      name: STORAGE_KEYS.lock,
      version: 2,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s) => ({
        isLocked: s.isLocked,
        sessionHash: s.sessionHash,
      }),
      migrate: (persisted) => {
        const parsed = LockPersistSchema.safeParse(persisted ?? {})
        const raw = parsed.success ? parsed.data : {}
        return {
          isLocked: raw.isLocked === true,
          sessionHash: typeof raw.sessionHash === 'string' ? raw.sessionHash : null,
        }
      },
      onRehydrateStorage: () => (state) => {
        // 有锁无哈希（旧数据）则强制解锁，避免死锁
        if (state?.isLocked && !state.sessionHash) {
          state.isLocked = false
        }
        state?.setHasHydrated(true)
      },
    },
  ),
)
