'use client'

import { memo } from 'react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { ChatComposer } from './ChatComposer'
import { MessageList } from './MessageList'
import { useAiChat } from './hooks/useAiChat'
import type { AiChatProps } from './types'

export type { AiChatProps } from './types'

/**
 * 智聊：流式对话 + 表情；历史存服务端 .data/ai-chat/session.json。
 * API Key 由服务端环境变量 SILICONFLOW_API_KEY 提供。
 * memo：窗口 isActive/zIndex 切换时避免整树重渲染导致虚拟列表滚动条跳动。
 */
export const AiChatApp = memo(function AiChatApp({ embedded = false }: AiChatProps = {}) {
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
})
