import { Geist, Geist_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const messages = await getMessages()
  const locale = await getLocale()

  return (
    <html lang={locale}>
      <NextIntlClientProvider messages={messages}>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
      </NextIntlClientProvider>
    </html>
  )
}
