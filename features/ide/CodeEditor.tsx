'use client'

import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject, type UIEvent } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { winChromePanel, winChromeSunken } from '@/lib/winChrome'
import { collectFindMatches } from './FindReplace'
import { suggestEmmet, type EmmetSuggestion } from './emmet'
import { highlightCode } from './highlight'
import type { IdeLanguage } from './languages'
import './prism-theme.css'

type Props = {
  value: string
  language: IdeLanguage
  ariaLabel: string
  /** 换文件 / 新建时递增，清空撤销栈；保存、查找替换不要改 */
  historyEpoch?: number
  searchQuery?: string
  searchMatchCase?: boolean
  searchActiveStart?: number
  onChange: (next: string) => void
  onCursorChange?: (line: number, col: number) => void
  textareaRef?: RefObject<Nullable<HTMLTextAreaElement>>
}

const EDITOR_FONT = 'font-mono text-[12px] leading-5'
const TAB_SPACES = '    '
const LINE_PX = 20
const PAD_Y = 6
const MAX_HISTORY = 200
const TYPING_GROUP_MS = 400

type HistorySnap = { text: string; start: number; end: number }

function lineCount(text: string): number {
  let n = 1
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) n++
  }
  return n
}

function lineColFromIndex(text: string, index: number): { line: number; col: number } {
  let line = 1
  let col = 1
  const end = Math.max(0, Math.min(index, text.length))
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++
      col = 1
    } else {
      col++
    }
  }
  return { line, col }
}

function lineIndent(text: string, caret: number): string {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1
  const line = text.slice(lineStart, caret)
  const m = line.match(/^[ \t]*/)
  return m ? m[0] : ''
}

const charWidthCache = new Map<string, number>()

function measureCharWidth(ta: HTMLTextAreaElement): number {
  const font = getComputedStyle(ta).font
  const hit = charWidthCache.get(font)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 7.2
  ctx.font = font
  const w = ctx.measureText('M').width || 7.2
  charWidthCache.set(font, w)
  return w
}

function emmetPopupPos(
  ta: HTMLTextAreaElement,
  pane: HTMLElement,
  caret: number,
): { left: number; top: number; above: boolean } {
  const { line, col } = lineColFromIndex(ta.value, caret)
  const charW = measureCharWidth(ta)
  const left = Math.max(4, Math.min(8 + (col - 1) * charW - ta.scrollLeft, pane.clientWidth - 168))
  const lineTop = PAD_Y + (line - 1) * LINE_PX - ta.scrollTop
  const lineBottom = lineTop + LINE_PX
  const above = lineBottom + 88 > pane.clientHeight && lineTop > 88
  return { left, top: above ? lineTop - 2 : lineBottom + 2, above }
}

function buildSearchMarks(
  text: string,
  query: string,
  matchCase: boolean,
  activeStart: number,
): ReactNode {
  const needle = query.trim()
  if (!needle) return null
  const matches = collectFindMatches(text, needle, matchCase)
  if (matches.length === 0) return null
  const len = needle.length
  const nodes: ReactNode[] = []
  let cursor = 0
  for (const start of matches) {
    if (start > cursor) nodes.push(text.slice(cursor, start))
    const current = start === activeStart
    nodes.push(
      <mark
        key={start}
        className={current ? 'ide-search-current' : 'ide-search-match'}
      >
        {text.slice(start, start + len)}
      </mark>,
    )
    cursor = start + len
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

export function CodeEditor({
  value,
  language,
  ariaLabel,
  historyEpoch = 0,
  searchQuery = '',
  searchMatchCase = false,
  searchActiveStart = -1,
  onChange,
  onCursorChange,
  textareaRef,
}: Props) {
  const t = useTranslations('ide')
  const localRef = useRef<HTMLTextAreaElement>(null)
  const gutterInnerRef = useRef<HTMLDivElement>(null)
  const highlightInnerRef = useRef<HTMLPreElement>(null)
  const searchInnerRef = useRef<HTMLPreElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const taRef = textareaRef ?? localRef
  const emmetRef = useRef<Nullable<EmmetSuggestion>>(null)
  const [emmet, setEmmet] = useState<Nullable<EmmetSuggestion>>(null)
  const [emmetPos, setEmmetPos] = useState({ left: 0, top: 0, above: false })
  const undoStack = useRef<HistorySnap[]>([])
  const redoStack = useRef<HistorySnap[]>([])
  const lastTextRef = useRef(value)
  const selRef = useRef({ start: 0, end: 0 })
  const fromSelfRef = useRef(false)
  const typingRef = useRef(false)
  const typingTimer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null)
  const epochRef = useRef(historyEpoch)

  const lines = lineCount(value)
  const gutterWidth = `${Math.max(2, String(lines).length) + 1}ch`
  const highlighted = useMemo(() => highlightCode(value, language), [value, language])
  const searchMarks = useMemo(
    () => buildSearchMarks(value, searchQuery, searchMatchCase, searchActiveStart),
    [value, searchQuery, searchMatchCase, searchActiveStart],
  )

  const syncScroll = () => {
    const ta = taRef.current
    if (!ta) return
    const top = ta.scrollTop
    const left = ta.scrollLeft
    const transformY = `translateY(${-top}px)`
    const transform = `translate(${-left}px, ${-top}px)`
    if (gutterInnerRef.current) gutterInnerRef.current.style.transform = transformY
    if (highlightInnerRef.current) highlightInnerRef.current.style.transform = transform
    if (searchInnerRef.current) searchInnerRef.current.style.transform = transform
  }

  const emitCursor = () => {
    const ta = taRef.current
    if (!ta || !onCursorChange) return
    const { line, col } = lineColFromIndex(ta.value, ta.selectionStart)
    onCursorChange(line, col)
  }

  const rememberSel = () => {
    const ta = taRef.current
    if (!ta) return
    selRef.current = { start: ta.selectionStart, end: ta.selectionEnd }
  }

  const closeTyping = () => {
    typingRef.current = false
    if (typingTimer.current) {
      clearTimeout(typingTimer.current)
      typingTimer.current = null
    }
  }

  const pushUndo = (snap: HistorySnap) => {
    const stack = undoStack.current
    const last = stack[stack.length - 1]
    if (last && last.text === snap.text) return
    stack.push(snap)
    if (stack.length > MAX_HISTORY) stack.shift()
    redoStack.current = []
  }

  const emitChange = (next: string) => {
    fromSelfRef.current = true
    lastTextRef.current = next
    onChange(next)
  }

  const applySnapshot = (snap: HistorySnap) => {
    emitChange(snap.text)
    requestAnimationFrame(() => {
      const ta = taRef.current
      if (ta) {
        ta.selectionStart = snap.start
        ta.selectionEnd = snap.end
        selRef.current = { start: snap.start, end: snap.end }
        syncScroll()
        emitCursor()
      }
    })
  }

  const currentSnap = (): HistorySnap => {
    const ta = taRef.current
    return {
      text: lastTextRef.current,
      start: ta?.selectionStart ?? selRef.current.start,
      end: ta?.selectionEnd ?? selRef.current.end,
    }
  }

  const undo = () => {
    closeTyping()
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(currentSnap())
    applySnapshot(prev)
  }

  const redo = () => {
    closeTyping()
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(currentSnap())
    applySnapshot(next)
  }

  useLayoutEffect(() => {
    if (epochRef.current !== historyEpoch) {
      epochRef.current = historyEpoch
      undoStack.current = []
      redoStack.current = []
      closeTyping()
      lastTextRef.current = value
      fromSelfRef.current = false
    } else if (fromSelfRef.current) {
      fromSelfRef.current = false
      lastTextRef.current = value
    } else if (value !== lastTextRef.current) {
      pushUndo({
        text: lastTextRef.current,
        start: selRef.current.start,
        end: selRef.current.end,
      })
      lastTextRef.current = value
      closeTyping()
    }
    syncScroll()
    emitCursor()
    // value / epoch 变化后对齐滚动、光标与撤销栈
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, historyEpoch])

  useLayoutEffect(() => {
    syncScroll()
    // 查找高亮层挂载后对齐滚动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMarks])

  const onScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    const top = ta.scrollTop
    const left = ta.scrollLeft
    const transformY = `translateY(${-top}px)`
    const transform = `translate(${-left}px, ${-top}px)`
    if (gutterInnerRef.current) gutterInnerRef.current.style.transform = transformY
    if (highlightInnerRef.current) highlightInnerRef.current.style.transform = transform
    if (searchInnerRef.current) searchInnerRef.current.style.transform = transform
    const sug = emmetRef.current
    const pane = paneRef.current
    if (sug && pane) setEmmetPos(emmetPopupPos(ta, pane, sug.end))
  }

  const hideEmmet = () => {
    emmetRef.current = null
    setEmmet(null)
  }

  const refreshEmmet = (ta?: Nullable<HTMLTextAreaElement>) => {
    const el = ta ?? taRef.current
    const pane = paneRef.current
    if (!el || el.selectionStart !== el.selectionEnd) {
      hideEmmet()
      return
    }
    const next = suggestEmmet(el.value, el.selectionStart, language)
    emmetRef.current = next
    setEmmet(next)
    if (next && pane) setEmmetPos(emmetPopupPos(el, pane, next.end))
  }

  useLayoutEffect(() => {
    refreshEmmet()
    // 文本 / 语言变化后更新 Emmet 预览
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, language])

  const applyEdit = (next: string, caret: number) => {
    closeTyping()
    pushUndo(currentSnap())
    emitChange(next)
    requestAnimationFrame(() => {
      const ta = taRef.current
      if (ta) {
        ta.selectionStart = ta.selectionEnd = caret
        selRef.current = { start: caret, end: caret }
        syncScroll()
        emitCursor()
        refreshEmmet(ta)
      }
    })
  }

  const expandEmmet = (sug: EmmetSuggestion, text: string) => {
    hideEmmet()
    applyEdit(`${text.slice(0, sug.start)}${sug.expanded}${text.slice(sug.end)}`, sug.caret)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const text = ta.value
    const mod = e.metaKey || e.ctrlKey

    if (mod && !e.altKey) {
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
        return
      }
    }

    rememberSel()

    if (e.key === 'Escape' && emmetRef.current) {
      e.preventDefault()
      hideEmmet()
      return
    }

    if (e.key === 'Tab' && !mod && !e.altKey) {
      if (!e.shiftKey) {
        const sug = start === end ? suggestEmmet(text, start, language) : null
        if (sug) {
          e.preventDefault()
          expandEmmet(sug, text)
          return
        }
      }
      e.preventDefault()
      applyEdit(`${text.slice(0, start)}${TAB_SPACES}${text.slice(end)}`, start + TAB_SPACES.length)
      return
    }

    if (e.key === 'Enter' && !mod && !e.altKey && !e.shiftKey) {
      const sug = emmetRef.current
      if (sug && start === end && start === sug.end) {
        e.preventDefault()
        expandEmmet(sug, text)
        return
      }
      e.preventDefault()
      const indent = lineIndent(text, start)
      applyEdit(`${text.slice(0, start)}\n${indent}${text.slice(end)}`, start + 1 + indent.length)
      return
    }

    requestAnimationFrame(() => {
      rememberSel()
      emitCursor()
      refreshEmmet(ta)
    })
  }

  return (
    <div className={cn(winChromeSunken, 'flex-1 min-h-0 flex overflow-hidden bg-field')}>
      <div
        aria-hidden
        className={cn(
          'shrink-0 overflow-hidden select-none pointer-events-none',
          'bg-[#d4d0c8] dark:bg-[#3a3a3a] text-[#808080] dark:text-[#8a8a8a]',
          'border-r border-chrome-dark',
          EDITOR_FONT,
        )}
        style={{ width: gutterWidth }}
      >
        <div ref={gutterInnerRef} className='will-change-transform' style={{ paddingTop: PAD_Y, paddingBottom: PAD_Y }}>
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className='px-1 text-right' style={{ height: LINE_PX, lineHeight: `${LINE_PX}px` }}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      <div ref={paneRef} className='relative flex-1 min-w-0 min-h-0 overflow-hidden'>
        <div className='absolute inset-0 overflow-hidden pointer-events-none' aria-hidden>
          {searchMarks ? (
            <pre
              ref={searchInnerRef}
              className={cn(
                EDITOR_FONT,
                'absolute top-0 left-0 m-0 min-w-full w-max pointer-events-none text-transparent whitespace-pre will-change-transform',
              )}
              style={{ padding: `${PAD_Y}px 8px`, tabSize: 4, lineHeight: `${LINE_PX}px` }}
            >
              {searchMarks}
              {'\n'}
            </pre>
          ) : null}
          <pre
            ref={highlightInnerRef}
            className={cn(
              EDITOR_FONT,
              'ide-prism absolute top-0 left-0 m-0 min-w-full w-max pointer-events-none text-on-chrome whitespace-pre will-change-transform',
            )}
            style={{ padding: `${PAD_Y}px 8px`, tabSize: 4, lineHeight: `${LINE_PX}px` }}
          >
            <code style={{ font: 'inherit' }} dangerouslySetInnerHTML={{ __html: highlighted || ' ' }} />
            {'\n'}
          </pre>
        </div>
        <textarea
          ref={taRef}
          value={value}
          spellCheck={false}
          autoCapitalize='off'
          autoComplete='off'
          autoCorrect='off'
          wrap='off'
          aria-label={ariaLabel}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          onKeyUp={() => {
            rememberSel()
            emitCursor()
            refreshEmmet()
          }}
          onClick={() => {
            rememberSel()
            emitCursor()
            refreshEmmet()
          }}
          onSelect={() => {
            rememberSel()
            emitCursor()
            refreshEmmet()
          }}
          onChange={(e) => {
            if (!typingRef.current) {
              pushUndo({
                text: lastTextRef.current,
                start: selRef.current.start,
                end: selRef.current.end,
              })
              typingRef.current = true
            }
            if (typingTimer.current) clearTimeout(typingTimer.current)
            typingTimer.current = setTimeout(closeTyping, TYPING_GROUP_MS)
            emitChange(e.target.value)
            requestAnimationFrame(() => {
              rememberSel()
              syncScroll()
              emitCursor()
              refreshEmmet(e.target)
            })
          }}
          className={cn(
            EDITOR_FONT,
            'absolute inset-0 w-full h-full resize-none overflow-auto bg-transparent',
            'text-transparent caret-black dark:caret-white outline-none whitespace-pre',
            'selection:bg-[#000080]/40 selection:text-transparent',
          )}
          style={{ padding: `${PAD_Y}px 8px`, tabSize: 4, lineHeight: `${LINE_PX}px` }}
        />
        {emmet ? (
          <div
            role='listbox'
            aria-label={t('emmetLabel')}
            className={cn(
              winChromePanel,
              'absolute z-30 max-w-[min(360px,calc(100%-16px))] max-h-48 overflow-auto p-1.5 shadow-md',
            )}
            style={{
              left: emmetPos.left,
              top: emmetPos.top,
              transform: emmetPos.above ? 'translateY(-100%)' : undefined,
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              const ta = taRef.current
              if (ta) expandEmmet(emmet, ta.value)
            }}
          >
            <div className='mb-1 flex items-baseline justify-between gap-3 text-[10px] leading-4 text-[#000080] dark:text-blue-300'>
              <span className='truncate font-bold'>
                {t('emmetLabel')} · {emmet.abbreviation}
              </span>
              <span className='shrink-0 opacity-80'>{t('emmetHint')}</span>
            </div>
            <pre className='m-0 font-mono text-[11px] leading-4 whitespace-pre text-on-chrome'>{emmet.preview}</pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}
