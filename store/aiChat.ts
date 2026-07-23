import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'

type AiChatState = {
  /** 硅基流动 API Key（随备份导出） */
  apiKey: string
  _hasHydrated: boolean
  setApiKey: (apiKey: string) => void
  clearApiKey: () => void
  setHasHydrated: (value: boolean) => void
}

const isClient = typeof window !== 'undefined'

export const useAiChatStore = create<AiChatState>()(
  persist(
    (set) => ({
      apiKey: '',
      _hasHydrated: false,
      setApiKey: (apiKey) => set({ apiKey: apiKey.trim() }),
      clearApiKey: () => set({ apiKey: '' }),
      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: STORAGE_KEYS.aiChat,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s) => ({ apiKey: s.apiKey }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

if (isClient) {
  const markHydrated = () => {
    const s = useAiChatStore.getState()
    if (!s._hasHydrated) useAiChatStore.setState({ _hasHydrated: true })
  }
  useAiChatStore.persist.onFinishHydration(markHydrated)
  if (useAiChatStore.persist.hasHydrated()) markHydrated()
}
