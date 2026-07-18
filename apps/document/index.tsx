'use client'

import { useState } from 'react'
import { cn } from '@/utils/cn'
import { Panel } from '@/components/ui'

export interface DocumentProps {
  embedded?: boolean
}

type DocId = 'welcome' | 'desktop' | 'apps' | 'about'

type DocItem = {
  id: DocId
  title: string
  body: string[]
}

const DOCS: DocItem[] = [
  {
    id: 'welcome',
    title: '欢迎',
    body: [
      '欢迎来到这台小小的桌面。',
      '它不是真正的操作系统，却故意长得像一台上世纪 90 年代的个人电脑：立体按钮、任务栏、可拖拽的图标，以及偶尔会卡住的心情。',
      '双击桌面上的图标可以打开对应窗口；任务栏会记住你打开的顺序——最新打开的会排在更靠右的位置。',
      '如果你只是想随便逛逛，从左边选一篇文档读一读就好。这里没有账号，也没有提交按钮。',
    ],
  },
  {
    id: 'desktop',
    title: '桌面指南',
    body: [
      '图标可以拖动。把它们挪到舒服的格子里，位置会记住，刷新之后还在。',
      '壁纸可以在「设置」里更换：有几张预设，也可以上传自己的图片。图片会保存在本机，尽量用原图，全屏会更清晰。',
      '窗口可以拖动标题栏移动，拖边缘调整大小，点「—」最小化，点「□」最大化，点「✕」关闭。',
      '任务栏左侧是开始区，中间是已打开的窗口，右侧有主题、语言和一些装饰按钮——后者暂时只是摆设。',
    ],
  },
  {
    id: 'apps',
    title: '内置应用',
    body: [
      '扫雷与俄罗斯方块：两款经典小游戏，适合发呆。',
      '音乐：可以播演示曲，也能搜 Audius 上的开放曲库；热门正版歌请用「本地」导入自己的文件。',
      '设置：目前主要管显示与壁纸。',
      '文档：就是你现在看到的这个窗口。内容是写死的，不会联网，也不会保存你的批注。',
      '其余图标（邀请、桥、市场……）还在装修中，双击暂时打不开——请当作未来的预告海报。',
    ],
  },
  {
    id: 'about',
    title: '关于',
    body: [
      '名称：Mini Desktop',
      '气质：Win95 怀旧壳 + 一点当代网页',
      '字体：尽量像系统对话框里的那种无衬线字',
      '声明：本应用中的壁纸、音乐与文案仅供演示与自娱。请尊重版权，不要把别人的作品当成自己的发布。',
      '版本札记：文档窗口 · 第一版 · 没有修订历史 · 也没有「另存为」。',
    ],
  },
]

export function DocumentApp({ embedded = false }: DocumentProps = {}) {
  const [activeId, setActiveId] = useState<DocId>('welcome')
  const active = DOCS.find((d) => d.id === activeId) ?? DOCS[0]

  return (
    <div
      className={cn(
        'h-full min-h-0 flex flex-col text-sm text-on-chrome bg-window font-pixel',
        !embedded && 'min-h-screen p-4',
        embedded && '-m-3 min-h-[360px]',
      )}
    >
      <div className={cn('flex-1 min-h-0 flex gap-2 p-2', embedded && 'p-3')}>
        <Panel padded={false} className='w-[128px] shrink-0 flex flex-col overflow-hidden'>
          <div className='px-2 py-1.5 text-[11px] font-bold border-b border-chrome-dark bg-chrome-hover/40'>目录</div>
          <ul className='flex-1 overflow-y-auto p-1'>
            {DOCS.map((doc) => {
              const selected = doc.id === activeId
              return (
                <li key={doc.id}>
                  <button
                    type='button'
                    className={cn(
                      'w-full text-left px-2 py-1 text-[11px] truncate',
                      selected
                        ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]'
                        : 'hover:bg-chrome-hover',
                    )}
                    onClick={() => setActiveId(doc.id)}
                  >
                    {doc.title}
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel inset className='flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden'>
          <h2 className='text-base font-bold mb-2 shrink-0 border-b border-[#808080] pb-1'>{active.title}</h2>
          <div className='flex-1 min-h-0 overflow-y-auto space-y-3 text-[12px] leading-relaxed text-[#222] dark:text-[#ddd]'>
            {active.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </Panel>
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-[#808080] bg-[#d4d0c8] dark:bg-[#2e2e2e] text-[10px] text-[#555] dark:text-[#999]'>
        只读文档 · 共 {DOCS.length} 篇 · 当前：{active.title}
      </div>
    </div>
  )
}
