declare module '*.css'

declare module 'prismjs' {
  const Prism: {
    highlight(code: string, grammar: object, language: string): string
    languages: Record<string, object | undefined>
  }
  export default Prism
}

declare module 'prismjs/components/prism-markup'
declare module 'prismjs/components/prism-css'
declare module 'prismjs/components/prism-clike'
declare module 'prismjs/components/prism-javascript'
declare module 'prismjs/components/prism-typescript'
declare module 'prismjs/components/prism-json'
