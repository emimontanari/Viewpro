import type { Metadata } from 'next'
import { Alegreya_Sans, Newsreader } from 'next/font/google'
import type { ReactNode } from 'react'

import './globals.css'

const displayFont = Newsreader({
  subsets: ['latin'],
  variable: '--font-viewpro-display',
  weight: ['400', '500', '600', '700'],
})

const bodyFont = Alegreya_Sans({
  subsets: ['latin'],
  variable: '--font-viewpro-body',
  weight: ['400', '500', '700', '800'],
})

export const metadata: Metadata = {
  title: 'ViewPro',
  description: 'Seguimiento inmobiliario transparente para propietarios',
}

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html className={`${displayFont.variable} ${bodyFont.variable}`} lang="es">
      <body>{children}</body>
    </html>
  )
}
