'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { KeyRound } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button } from '@/components/ui'
import { useAiChatStore } from '@/store/aiChat'
import { ChatComposer } from './ChatComposer'
import { MessageList } from './MessageList'
import { useAiChat } from './hooks/useAiChat'
import { promptAiChatApiKey } from './promptApiKey'
import type { AiChatProps } from './types'

export type { AiChatProps } from './types'

/**
 * 智聊：流式对话 + 表情；历史存服务端 .data/ai-chat/session.json。
 * 首次需录入 API Key（persist，可随备份导出）。
 */
export function AiChatApp({ embedded = false }: AiChatProps = {}) {
  const t = useTranslations('aiChat')
  const apiKey = useAiChatStore((s) => s.apiKey)
  const hydrated = useAiChatStore((s) => s._hasHydrated)
  const setApiKey = useAiChatStore((s) => s.setApiKey)
  const promptedRef = useRef(false)

  const hasKey = apiKey.trim().length > 0

  const openKeyPrompt = async () => {
    const key = await promptAiChatApiKey({ initialKey: useAiChatStore.getState().apiKey })
    if (key) setApiKey(key)
  }

  useEffect(() => {
    if (!hydrated || promptedRef.current) return
    promptedRef.current = true
    if (useAiChatStore.getState().apiKey.trim()) return
    void openKeyPrompt()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 水合后仅自动弹一次
  }, [hydrated])

  if (!hydrated) {
    return (
      <div
        className={cn(
          embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
          !embedded && 'p-4',
        )}
      >
        <p className='p-4 text-[11px] text-muted'>{t('apiKeyPreparing')}</p>
      </div>
    )
  }

  if (!hasKey) {
    return (
      <div
        className={cn(
          embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
          !embedded && 'p-4',
        )}
      >
        <div className='flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-6 text-center'>
          <KeyRound className='w-8 h-8 text-muted' aria-hidden />
          <p className='text-[12px] text-muted leading-relaxed max-w-[280px]'>{t('apiKeyRequired')}</p>
          <Button type='button' size='sm' onClick={() => void openKeyPrompt()}>
            {t('apiKeyEnter')}
          </Button>
        </div>
      </div>
    )
  }

  return <AiChatReady embedded={embedded} onChangeApiKey={() => void openKeyPrompt()} />
}

function AiChatReady({ embedded, onChangeApiKey }: { embedded: boolean; onChangeApiKey: () => void }) {
  const {
    messages,
    historyLoading,
    historyLoadingMore,
    hasMoreHistory,
    streaming,
    sessionEpoch,
    inputRef,
    stop,
    clearChat,
    deleteMessage,
    loadOlderMessages,
    sendText,
  } = useAiChat()

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
    >
      <div className='flex-1 min-h-0 flex flex-col gap-2 p-2'>
        <MessageList
          messages={messages}
          historyLoading={historyLoading}
          historyLoadingMore={historyLoadingMore}
          hasMoreHistory={hasMoreHistory}
          streaming={streaming}
          onClear={() => void clearChat()}
          onDeleteMessage={(id) => void deleteMessage(id)}
          onLoadOlder={loadOlderMessages}
          onQuickPrompt={(text) => void sendText(text)}
          onChangeApiKey={onChangeApiKey}
        />
        <ChatComposer
          inputRef={inputRef}
          streaming={streaming}
          sessionEpoch={sessionEpoch}
          onSend={(text) => void sendText(text)}
          onStop={stop}
        />
      </div>
    </div>
  )
}
