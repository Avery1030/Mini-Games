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
                const media = window.matchMedia('(prefers-color-scheme: dark)');
                const isDark = theme === 'dark' || (!theme && media.matches);
                document.documentElement.classList.toggle('dark', isDark);
              `,
          }}
        />
      </head>
      <body className='antialiased'>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider attribute='class' defaultTheme='system' enableSystem storageKey='app-theme'>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
