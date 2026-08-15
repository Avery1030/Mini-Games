import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-json'
import type { IdeLanguage } from './languages'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function highlightCode(code: string, language: IdeLanguage): string {
  if (!code) return ''
  if (language === 'plain') return escapeHtml(code)
  const grammar = Prism.languages[language]
  if (!grammar) return escapeHtml(code)
  return Prism.highlight(code, grammar, language)
}
