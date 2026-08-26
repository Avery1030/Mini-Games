import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import { ThemeProvider } from 'next-themes'
import { ModalHost, ToastHost, type ModalHostLabels } from '@/components/ui'
import { STORAGE_KEYS } from '@/lib/storage'
import './globals.css'

const THEME_STORAGE_KEY = STORAGE_KEYS.theme

function modalLabelsFromMessages(messages: unknown): ModalHostLabels | undefined {
  if (!messages || typeof messages !== 'object' || !('modal' in messages)) return undefined
  const modal = (messages as { modal?: unknown }).modal
  if (!modal || typeof modal !== 'object') return undefined
  const rec = modal as Record<string, unknown>
  if (typeof rec.ok !== 'string' || typeof rec.cancel !== 'string' || typeof rec.title !== 'string') {
    return undefined
  }
  return { ok: rec.ok, cancel: rec.cancel, title: rec.title }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const messages = await getMessages()
  const locale = await getLocale()
  const modalLabels = modalLabelsFromMessages(messages)

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
                const key = ${JSON.stringify(THEME_STORAGE_KEY)};
                let theme;
                try {
                  theme = localStorage.getItem(key);
                } catch {}
                // 仅 light / dark；历史 system 或空值一律按 light
                const isDark = theme === 'dark';
                document.documentElement.classList.toggle('dark', isDark);
              `,
          }}
        />
      </head>
      <body className='antialiased'>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute='class'
            defaultTheme='light'
            enableSystem={false}
            themes={['light', 'dark']}
            storageKey={THEME_STORAGE_KEY}
          >
            {children}
            <ModalHost labels={modalLabels} />
            <ToastHost />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
