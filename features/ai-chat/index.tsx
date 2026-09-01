'use client'

import { memo, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { MasterDetail } from '@/components/ui'
import { useIsMobileViewport } from '@/hooks/desktop'
import { ChatComposer } from './ChatComposer'
import { MessageList } from './MessageList'
import { SessionSidebar } from './SessionSidebar'
import { useAiChat } from './hooks/useAiChat'

/**
 * 智聊：多会话 + 流式对话；历史存独立 IndexedDB；.chat 导入导出走 VFS。
 */
export const AiChatApp = memo(function AiChatApp() {
  const t = useTranslations('aiChat')
  const tm = useTranslations('mobile')
  const isMobile = useIsMobileViewport()
  const [detailOpen, setDetailOpen] = useState(true)
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

  const activeTitle = useMemo(
    () => sessions.find((s) => s.id === activeSessionId)?.title ?? t('sessions'),
    [sessions, activeSessionId, t],
  )

  return (
    <div
      className={cn(
        embeddedAppShell('flex flex-col text-sm text-on-chrome bg-window font-pixel'),
      )}
    >
      <div className={cn('flex-1 min-h-0 flex m-2', isMobile && 'm-0')}>
        <MasterDetail
          defaultSize={140}
          minSize={110}
          maxSize={220}
          storageKey='split:ai-chat'
          isMobile={isMobile}
          backLabel={tm('backToList')}
          detailOpen={detailOpen}
          onDetailOpenChange={setDetailOpen}
          detailTitle={activeTitle}
        >
          <SessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            streaming={streaming}
            onNew={() => {
              void newSession()
              setDetailOpen(true)
            }}
            onSelect={(id) => {
              void selectSession(id)
              setDetailOpen(true)
            }}
            onRename={(id) => void renameSessionById(id)}
            onDelete={(id) => void deleteSessionById(id)}
            onExport={() => void exportActiveSession()}
            onImport={() => void importFromVfs()}
          />
          <div className='h-full min-h-0 min-w-0 flex flex-col gap-2 p-2 max-md:p-2.5'>
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
        </MasterDetail>
      </div>
    </div>
  )
})
