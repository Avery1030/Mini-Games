import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import { ThemeProvider } from 'next-themes'
import './globals.css'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const messages = await getMessages()
  const locale = await getLocale()

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
                const key = 'app-theme';
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
            storageKey='app-theme'
          >
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
