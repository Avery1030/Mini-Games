'use client'

import { memo } from 'react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { SplitPane } from '@/components/ui'
import { ChatComposer } from './ChatComposer'
import { MessageList } from './MessageList'
import { SessionSidebar } from './SessionSidebar'
import { useAiChat } from './hooks/useAiChat'
import type { AiChatProps } from './types'

export type { AiChatProps } from './types'

/**
 * 智聊：多会话 + 流式对话；历史存独立 IndexedDB；.chat 导入导出走 VFS。
 */
export const AiChatApp = memo(function AiChatApp({ embedded = false }: AiChatProps = {}) {
  const {
    sessions,
    activeSessionId,
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
    newSession,
    selectSession,
    renameSessionById,
    deleteSessionById,
    exportActiveSession,
    importFromVfs,
  } = useAiChat()

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
    >
      <div className='flex-1 min-h-0 flex m-2'>
        <SplitPane defaultSize={140} minSize={110} maxSize={220} storageKey='split:ai-chat'>
          <SessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            streaming={streaming}
            onNew={() => void newSession()}
            onSelect={(id) => void selectSession(id)}
            onRename={(id) => void renameSessionById(id)}
            onDelete={(id) => void deleteSessionById(id)}
            onExport={() => void exportActiveSession()}
            onImport={() => void importFromVfs()}
          />
          <div className='h-full min-h-0 min-w-0 flex flex-col gap-2 p-2'>
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
        </SplitPane>
      </div>
    </div>
  )
})
