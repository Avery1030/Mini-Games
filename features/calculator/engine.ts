/**
 * 安全表达式求值：支持 + - * / % ^ 与括号、一元正负号。
 * 不含任意代码执行。
 */

const OPS: Record<string, { prec: number; assoc: 'L' | 'R'; fn: (a: number, b: number) => number }> = {
  '+': { prec: 1, assoc: 'L', fn: (a, b) => a + b },
  '-': { prec: 1, assoc: 'L', fn: (a, b) => a - b },
  '*': { prec: 2, assoc: 'L', fn: (a, b) => a * b },
  '/': { prec: 2, assoc: 'L', fn: (a, b) => a / b },
  '%': { prec: 2, assoc: 'L', fn: (a, b) => a % b },
  '^': { prec: 3, assoc: 'R', fn: (a, b) => a ** b },
}

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'lparen' } | { t: 'rparen' } | { t: 'u-'; v: '-' }

// 将中缀表达式转换为 token 列表
function tokenize(input: string): Tok[] {
  const s = input.replace(/\s+/g, '')
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if ((c >= '0' && c <= '9') || c === '.') {
      let j = i + 1
      while (j < s.length && ((s[j]! >= '0' && s[j]! <= '9') || s[j] === '.')) j++
      const raw = s.slice(i, j)
      if ((raw.match(/\./g) ?? []).length > 1) throw new Error('bad number')
      const n = Number(raw)
      if (!Number.isFinite(n)) throw new Error('bad number')
      out.push({ t: 'num', v: n })
      i = j
      continue
    }
    if (c === '(') {
      out.push({ t: 'lparen' })
      i++
      continue
    }
    if (c === ')') {
      out.push({ t: 'rparen' })
      i++
      continue
    }
    if (c in OPS || c === '×' || c === '÷' || c === '−') {
      const op = c === '×' ? '*' : c === '÷' ? '/' : c === '−' ? '-' : c
      const prev = out[out.length - 1]
      const unary = op === '-' && (out.length === 0 || prev?.t === 'op' || prev?.t === 'lparen' || prev?.t === 'u-')
      if (unary) out.push({ t: 'u-', v: '-' })
      else out.push({ t: 'op', v: op })
      i++
      continue
    }
    throw new Error('bad char')
  }
  return out
}

/** 将中缀表达式转换为后缀表达式 */
function toRpn(tokens: Tok[]): Tok[] {
  const out: Tok[] = []
  const stack: Tok[] = []
  for (const tok of tokens) {
    if (tok.t === 'num') {
      out.push(tok)
      continue
    }
    if (tok.t === 'u-') {
      stack.push(tok)
      continue
    }
    if (tok.t === 'op') {
      const o1 = OPS[tok.v]!
      while (stack.length) {
        const top = stack[stack.length - 1]!
        if (top.t === 'u-') {
          out.push(stack.pop()!)
          continue
        }
        if (top.t !== 'op') break
        const o2 = OPS[top.v]!
        if ((o1.assoc === 'L' && o1.prec <= o2.prec) || (o1.assoc === 'R' && o1.prec < o2.prec)) {
          out.push(stack.pop()!)
        } else break
      }
      stack.push(tok)
      continue
    }
    if (tok.t === 'lparen') {
      stack.push(tok)
      continue
    }
    if (tok.t === 'rparen') {
      while (stack.length && stack[stack.length - 1]!.t !== 'lparen') {
        out.push(stack.pop()!)
      }
      if (!stack.length || stack[stack.length - 1]!.t !== 'lparen') throw new Error('paren')
      stack.pop()
      continue
    }
  }
  while (stack.length) {
    const t = stack.pop()!
    if (t.t === 'lparen' || t.t === 'rparen') throw new Error('paren')
    out.push(t)
  }
  return out
}

// 计算后缀表达式的值
function evalRpn(rpn: Tok[]): number {
  const st: number[] = []
  for (const tok of rpn) {
    if (tok.t === 'num') {
      st.push(tok.v)
      continue
    }
    if (tok.t === 'u-') {
      if (!st.length) throw new Error('unary')
      st.push(-st.pop()!)
      continue
    }
    if (tok.t === 'op') {
      if (st.length < 2) throw new Error('op')
      const b = st.pop()!
      const a = st.pop()!
      const r = OPS[tok.v]!.fn(a, b)
      if (!Number.isFinite(r)) throw new Error('math')
      st.push(r)
    }
  }
  if (st.length !== 1) throw new Error('expr')
  return st[0]!
}

// 格式化计算结果
export function formatCalcNumber(n: number): string {
  if (!Number.isFinite(n)) return 'Error'
  if (Object.is(n, -0)) return '0'
  const abs = Math.abs(n)
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-8)) {
    return n
      .toExponential(8)
      .replace(/\.?0+e/, 'e')
      .replace(/e\+/, 'e')
  }
  const s = String(Number(n.toPrecision(12)))
  return s
}

// 计算表达式的值
export function evaluateExpression(expr: string): number {
  const trimmed = expr.trim()
  if (!trimmed) throw new Error('empty')
  return evalRpn(toRpn(tokenize(trimmed)))
}

// 应用一元运算符
export function applyUnary(op: 'sqrt' | 'square' | 'reciprocal' | 'negate' | 'percent', value: number): number {
  let r: number
  switch (op) {
    case 'sqrt':
      if (value < 0) throw new Error('sqrt')
      r = Math.sqrt(value)
      break
    case 'square':
      r = value * value
      break
    case 'reciprocal':
      if (value === 0) throw new Error('div0')
      r = 1 / value
      break
    case 'negate':
      r = -value
      break
    case 'percent':
      r = value / 100
      break
  }
  if (!Number.isFinite(r)) throw new Error('math')
  return r
}
