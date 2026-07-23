'use client'

import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { ChatComposer } from './ChatComposer'
import { MessageList } from './MessageList'
import { useAiChat } from './hooks/useAiChat'
import type { AiChatProps } from './types'

export type { AiChatProps } from './types'

/**
 * 智聊：流式对话 + 表情；历史存服务端 .data/ai-chat/session.json。
 */
export function AiChatApp({ embedded = false }: AiChatProps = {}) {
  const {
    messages,
    historyLoading,
    streaming,
    sessionEpoch,
    listRef,
    inputRef,
    stop,
    clearChat,
    sendText,
    copyMessage,
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
          streaming={streaming}
          listRef={listRef}
          onClear={() => void clearChat()}
          onCopy={(content) => void copyMessage(content)}
          onQuickPrompt={(text) => void sendText(text)}
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
