'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Input } from '@/components/ui'
import { cn } from '@/lib/cn'
import { winChromePanel } from '@/lib/winChrome'

export type FindReplaceLabels = {
  find: string
  replace: string
  findNext: string
  replaceOne: string
  replaceAll: string
  close: string
  notFound: string
  matchCase: string
  formatReplaced: (count: number) => string
  formatMatchCount: (current: number, total: number) => string
}

type Props = {
  open: boolean
  mode: 'find' | 'replace'
  labels: FindReplaceLabels
  haystack: string
  getHaystack: () => string
  getSelectionStart: () => number
  applySelection: (start: number, end: number) => void
  replaceRange: (start: number, end: number, text: string) => void
  replaceAll: (search: string, replacement: string, caseSensitive: boolean) => number
  onClose: () => void
  onSearchChange?: (state: { query: string; matchCase: boolean; activeStart: number }) => void
}

export function collectFindMatches(haystack: string, needle: string, caseSensitive: boolean): number[] {
  if (!needle) return []
  const h = caseSensitive ? haystack : haystack.toLowerCase()
  const n = caseSensitive ? needle : needle.toLowerCase()
  const out: number[] = []
  let from = 0
  while (from <= h.length - n.length) {
    const idx = h.indexOf(n, from)
    if (idx < 0) break
    out.push(idx)
    from = idx + n.length
  }
  return out
}

function nextIndex(haystack: string, needle: string, from: number, caseSensitive: boolean): number {
  const matches = collectFindMatches(haystack, needle, caseSensitive)
  if (matches.length === 0) return -1
  const next = matches.find((idx) => idx >= from)
  return next ?? matches[0]!
}

export function FindReplacePanel({
  open,
  mode,
  labels,
  haystack,
  getHaystack,
  getSelectionStart,
  applySelection,
  replaceRange,
  replaceAll,
  onClose,
  onSearchChange,
}: Props) {
  const findRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [status, setStatus] = useState('')
  const [activeStart, setActiveStart] = useState(-1)

  const matches = collectFindMatches(haystack, query, matchCase)
  const total = matches.length
  const current = activeStart >= 0 ? matches.indexOf(activeStart) + 1 : 0

  useEffect(() => {
    if (!open) return
    setStatus('')
    requestAnimationFrame(() => findRef.current?.focus())
  }, [open, mode])

  useEffect(() => {
    if (!open || !query) {
      setActiveStart(-1)
      return
    }
    if (matches.includes(activeStart)) return
    setActiveStart(matches[0] ?? -1)
    // query / 大小写变化后，若当前命中已失效则回到第一处
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, matchCase, haystack])

  useEffect(() => {
    if (!open) {
      onSearchChange?.({ query: '', matchCase: false, activeStart: -1 })
      return
    }
    onSearchChange?.({ query, matchCase, activeStart })
  }, [open, query, matchCase, activeStart, onSearchChange])

  if (!open) return null

  const selectMatch = (idx: number) => {
    applySelection(idx, idx + query.length)
    setActiveStart(idx)
    requestAnimationFrame(() => findRef.current?.focus())
  }

  const findNext = () => {
    const needle = query
    if (!needle) return
    const text = getHaystack()
    const sel = getSelectionStart()
    const currentHit =
      activeStart === sel ||
      (matchCase
        ? text.slice(sel, sel + needle.length) === needle
        : text.slice(sel, sel + needle.length).toLowerCase() === needle.toLowerCase())
    const from = sel + (currentHit ? needle.length : 0)
    const idx = nextIndex(text, needle, from, matchCase)
    if (idx < 0) {
      setActiveStart(-1)
      setStatus(labels.notFound)
      return
    }
    setStatus('')
    selectMatch(idx)
  }

  const replaceOne = () => {
    const needle = query
    if (!needle) return
    const text = getHaystack()
    const start = getSelectionStart()
    const currentText = text.slice(start, start + needle.length)
    const hit = matchCase ? currentText === needle : currentText.toLowerCase() === needle.toLowerCase()
    if (hit) {
      replaceRange(start, start + currentText.length, replacement)
      setStatus('')
      requestAnimationFrame(() => {
        const next = nextIndex(getHaystack(), needle, start + replacement.length, matchCase)
        if (next >= 0) selectMatch(next)
        else {
          setActiveStart(-1)
          setStatus(labels.notFound)
        }
      })
      return
    }
    findNext()
  }

  const doReplaceAll = () => {
    const needle = query
    if (!needle) return
    const count = replaceAll(needle, replacement, matchCase)
    setActiveStart(-1)
    if (count === 0) {
      setStatus(labels.notFound)
      return
    }
    setStatus(labels.formatReplaced(count))
  }

  const matchLabel =
    !query.trim() ? '' : total === 0 ? labels.notFound : labels.formatMatchCount(Math.max(current, 1), total)

  return (
    <div className={cn(winChromePanel, 'absolute top-1 right-1 z-20 w-[min(280px,calc(100%-8px))] p-2 shadow-md')}>
      <div className='flex flex-col gap-1.5'>
        <div className='flex items-center gap-1'>
          <Input
            ref={findRef}
            size='sm'
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setStatus('')
            }}
            placeholder={labels.find}
            className='min-w-0 w-0 flex-1'
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                findNext()
              }
              if (e.key === 'Escape') onClose()
            }}
          />
          {matchLabel ? (
            <span
              className={cn(
                'shrink-0 text-[10px] tabular-nums',
                total === 0 ? 'text-red-700 dark:text-red-400' : 'text-muted',
              )}
            >
              {matchLabel}
            </span>
          ) : null}
        </div>
        {mode === 'replace' ? (
          <Input
            size='sm'
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder={labels.replace}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                replaceOne()
              }
              if (e.key === 'Escape') onClose()
            }}
          />
        ) : null}
        <Checkbox
          checked={matchCase}
          onChange={(e) => setMatchCase(e.target.checked)}
          label={labels.matchCase}
          className='text-[11px]'
        />
        <div className='flex flex-wrap gap-1'>
          <Button size='sm' onClick={findNext}>
            {labels.findNext}
          </Button>
          {mode === 'replace' ? (
            <>
              <Button size='sm' onClick={replaceOne}>
                {labels.replaceOne}
              </Button>
              <Button size='sm' onClick={doReplaceAll}>
                {labels.replaceAll}
              </Button>
            </>
          ) : null}
          <Button size='sm' variant='raised' onClick={onClose}>
            {labels.close}
          </Button>
        </div>
        {status ? <p className='text-[10px] text-red-700 dark:text-red-400 truncate'>{status}</p> : null}
      </div>
    </div>
  )
}
