'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button } from '@/components/ui'
import { winChromeSunken } from '@/lib/winChrome'
import { applyUnary, evaluateExpression, formatCalcNumber } from './engine'

export interface CalculatorProps {
  embedded?: boolean
}

type KeyDef = {
  id: string
  label: string
  span?: 2
  tone?: 'fn' | 'op' | 'eq' | 'mem'
  action: string
}

const ROWS: KeyDef[][] = [
  [
    { id: 'mc', label: 'MC', tone: 'mem', action: 'mc' },
    { id: 'mr', label: 'MR', tone: 'mem', action: 'mr' },
    { id: 'ms', label: 'MS', tone: 'mem', action: 'ms' },
    { id: 'm+', label: 'M+', tone: 'mem', action: 'm+' },
  ],
  [
    { id: 'ce', label: 'CE', tone: 'fn', action: 'ce' },
    { id: 'c', label: 'C', tone: 'fn', action: 'c' },
    { id: 'bs', label: '⌫', tone: 'fn', action: 'back' },
    { id: 'div', label: '÷', tone: 'op', action: '/' },
  ],
  [
    { id: 'sqrt', label: '√', tone: 'fn', action: 'sqrt' },
    { id: 'sq', label: 'x²', tone: 'fn', action: 'square' },
    { id: 'inv', label: '1/x', tone: 'fn', action: 'reciprocal' },
    { id: 'mul', label: '×', tone: 'op', action: '*' },
  ],
  [
    { id: 'lp', label: '(', tone: 'op', action: '(' },
    { id: 'rp', label: ')', tone: 'op', action: ')' },
    { id: 'pct', label: '%', tone: 'fn', action: 'percent' },
    { id: 'sub', label: '−', tone: 'op', action: '-' },
  ],
  [
    { id: '7', label: '7', action: '7' },
    { id: '8', label: '8', action: '8' },
    { id: '9', label: '9', action: '9' },
    { id: 'add', label: '+', tone: 'op', action: '+' },
  ],
  [
    { id: '4', label: '4', action: '4' },
    { id: '5', label: '5', action: '5' },
    { id: '6', label: '6', action: '6' },
    { id: 'pow', label: 'xʸ', tone: 'op', action: '^' },
  ],
  [
    { id: '1', label: '1', action: '1' },
    { id: '2', label: '2', action: '2' },
    { id: '3', label: '3', action: '3' },
    { id: 'neg', label: '±', tone: 'fn', action: 'negate' },
  ],
  [
    { id: '0', label: '0', span: 2, action: '0' },
    { id: 'dot', label: '.', action: '.' },
    { id: 'eq', label: '=', tone: 'eq', action: '=' },
  ],
]

function endsWithNumber(expr: string) {
  return /(?:\d|\.)$/.test(expr)
}

function lastNumberSpan(expr: string): { start: number; raw: string } | null {
  const m = expr.match(/(-?(?:\d+\.?\d*|\.\d+))$/)
  if (!m || m.index == null) return null
  return { start: m.index, raw: m[1]! }
}

/**
 * Win95 风格计算器：四则运算、括号、幂、开方等；支持键盘。
 */
export function CalculatorApp({ embedded = false }: CalculatorProps = {}) {
  const t = useTranslations('calculator')
  const [expr, setExpr] = useState('')
  const [display, setDisplay] = useState('0')
  const [error, setError] = useState(false)
  const [memory, setMemory] = useState(0)
  const [justEvaluated, setJustEvaluated] = useState(false)

  const showError = useCallback(() => {
    setError(true)
    setDisplay(t('error'))
    setJustEvaluated(true)
  }, [t])

  const readCurrent = useCallback((): number => {
    if (error) throw new Error('error')
    if (expr && endsWithNumber(expr)) {
      const span = lastNumberSpan(expr)
      if (span) return Number(span.raw)
    }
    const n = Number(display)
    if (!Number.isFinite(n)) throw new Error('nan')
    return n
  }, [display, error, expr])

  const replaceLastNumber = useCallback((value: number) => {
    const formatted = formatCalcNumber(value)
    setDisplay(formatted)
    setExpr((prev) => {
      const span = lastNumberSpan(prev)
      if (!span) return formatted
      return prev.slice(0, span.start) + formatted
    })
    setError(false)
    setJustEvaluated(false)
  }, [])

  const pushDigit = useCallback(
    (d: string) => {
      if (error || justEvaluated) {
        setExpr(d === '.' ? '0.' : d)
        setDisplay(d === '.' ? '0.' : d)
        setError(false)
        setJustEvaluated(false)
        return
      }
      setExpr((prev) => {
        const span = lastNumberSpan(prev)
        if (!span) {
          const next = prev + (d === '.' ? '0.' : d)
          setDisplay(d === '.' ? '0.' : d)
          return next
        }
        if (d === '.' && span.raw.includes('.')) return prev
        if (d !== '.' && (span.raw === '0' || span.raw === '-0')) {
          const next = prev.slice(0, span.start) + (span.raw.startsWith('-') ? `-${d}` : d)
          setDisplay(span.raw.startsWith('-') ? `-${d}` : d)
          return next
        }
        const nextNum = span.raw + d
        setDisplay(nextNum)
        return prev.slice(0, span.start) + nextNum
      })
    },
    [error, justEvaluated],
  )

  const pushOp = useCallback(
    (op: string) => {
      if (error) return
      setJustEvaluated(false)
      setExpr((prev) => {
        let next = prev
        if (!next) next = display === 'Error' ? '0' : display
        if (op === '(') {
          if (endsWithNumber(next) || next.endsWith(')')) next += '*'
          return next + '('
        }
        if (op === ')') {
          if (!next.includes('(')) return next
          return next + ')'
        }
        if (/[+\-*/^]$/.test(next)) return next.slice(0, -1) + op
        return next + op
      })
    },
    [display, error],
  )

  const doEquals = useCallback(() => {
    try {
      const source = expr || display
      const result = evaluateExpression(source)
      const formatted = formatCalcNumber(result)
      setDisplay(formatted)
      setExpr(formatted)
      setError(false)
      setJustEvaluated(true)
    } catch {
      showError()
    }
  }, [display, expr, showError])

  const doUnary = useCallback(
    (op: 'sqrt' | 'square' | 'reciprocal' | 'negate' | 'percent') => {
      try {
        const cur = readCurrent()
        const result = applyUnary(op, cur)
        replaceLastNumber(result)
        if (justEvaluated || !expr) {
          setExpr(formatCalcNumber(result))
          setJustEvaluated(false)
        }
      } catch {
        showError()
      }
    },
    [expr, justEvaluated, readCurrent, replaceLastNumber, showError],
  )

  const clearAll = useCallback(() => {
    setExpr('')
    setDisplay('0')
    setError(false)
    setJustEvaluated(false)
  }, [])

  const clearEntry = useCallback(() => {
    if (error || justEvaluated) {
      clearAll()
      return
    }
    setExpr((prev) => {
      const span = lastNumberSpan(prev)
      if (!span) {
        setDisplay('0')
        return prev
      }
      setDisplay('0')
      return prev.slice(0, span.start)
    })
  }, [clearAll, error, justEvaluated])

  const backspace = useCallback(() => {
    if (error || justEvaluated) {
      clearAll()
      return
    }
    setExpr((prev) => {
      if (!prev) {
        setDisplay('0')
        return ''
      }
      const next = prev.slice(0, -1)
      const span = lastNumberSpan(next)
      setDisplay(span ? span.raw : '0')
      return next
    })
  }, [clearAll, error, justEvaluated])

  const handleAction = useCallback(
    (action: string) => {
      switch (action) {
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
        case '.':
          pushDigit(action)
          return
        case '+':
        case '-':
        case '*':
        case '/':
        case '^':
        case '(':
        case ')':
          pushOp(action)
          return
        case '=':
          doEquals()
          return
        case 'c':
          clearAll()
          return
        case 'ce':
          clearEntry()
          return
        case 'back':
          backspace()
          return
        case 'sqrt':
        case 'square':
        case 'reciprocal':
        case 'negate':
        case 'percent':
          doUnary(action)
          return
        case 'mc':
          setMemory(0)
          return
        case 'mr':
          {
            const formatted = formatCalcNumber(memory)
            if (error || justEvaluated || !expr) {
              setExpr(formatted)
              setDisplay(formatted)
              setError(false)
              setJustEvaluated(false)
            } else {
              replaceLastNumber(memory)
            }
          }
          return
        case 'ms':
          try {
            setMemory(readCurrent())
          } catch {
            showError()
          }
          return
        case 'm+':
          try {
            setMemory((m) => m + readCurrent())
          } catch {
            showError()
          }
          return
        default:
          return
      }
    },
    [
      backspace,
      clearAll,
      clearEntry,
      doEquals,
      doUnary,
      error,
      expr,
      justEvaluated,
      memory,
      pushDigit,
      pushOp,
      readCurrent,
      replaceLastNumber,
      showError,
    ],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const k = e.key
      if (k >= '0' && k <= '9') {
        e.preventDefault()
        handleAction(k)
        return
      }
      if (k === '.' || k === ',') {
        e.preventDefault()
        handleAction('.')
        return
      }
      if (k === '+' || k === '-' || k === '*' || k === '/' || k === '^' || k === '(' || k === ')') {
        e.preventDefault()
        handleAction(k)
        return
      }
      if (k === 'Enter' || k === '=') {
        e.preventDefault()
        handleAction('=')
        return
      }
      if (k === 'Backspace') {
        e.preventDefault()
        handleAction('back')
        return
      }
      if (k === 'Escape') {
        e.preventDefault()
        handleAction('c')
        return
      }
      if (k === '%') {
        e.preventDefault()
        handleAction('percent')
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleAction])

  const toneClass = (tone?: KeyDef['tone']) => {
    if (tone === 'eq') {
      return 'font-bold bg-[var(--window-title-active)] text-[var(--window-title-text)] hover:brightness-110'
    }
    if (tone === 'op') {
      return 'font-bold text-[var(--window-title-active)] bg-chrome-hover/80'
    }
    if (tone === 'mem') return 'text-[11px] font-medium'
    if (tone === 'fn') return 'text-[11px] font-medium text-on-chrome'
    return 'font-medium'
  }

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
    >
      <div className={cn('flex-1 min-h-0 flex flex-col gap-2', embedded ? 'p-3' : 'p-2')}>
        <div className={cn(winChromeSunken, 'bg-field px-2 py-1.5 space-y-0.5')}>
          <div className='flex h-3.5 items-center justify-between gap-2 overflow-hidden text-[10px] leading-none text-muted'>
            <span className='min-w-0 truncate'>{expr}</span>
            <span className='w-3 shrink-0 text-right'>{memory !== 0 ? 'M' : ''}</span>
          </div>
          <div
            className={cn(
              'h-7 text-right text-xl font-bold leading-7 tabular-nums tracking-wide truncate',
              error && 'text-red-700',
            )}
            aria-live='polite'
          >
            {display}
          </div>
        </div>

        <div className='grid gap-1.5 flex-1 content-start' style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {ROWS.flat().map((key) => (
            <Button
              key={key.id}
              size='md'
              className={cn('h-8 w-full', key.span === 2 && 'col-span-2', toneClass(key.tone))}
              onClick={() => handleAction(key.action)}
              aria-label={key.label}
            >
              {key.label}
            </Button>
          ))}
        </div>
      </div>
      {/* <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg truncate'>
        {t('hint')}
      </div> */}
    </div>
  )
}
