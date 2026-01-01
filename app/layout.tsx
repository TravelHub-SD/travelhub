import type React from "react"
import type { Metadata } from "next"
import { Cairo } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const cairo = Cairo({ subsets: ["arabic", "latin"] })

export const metadata: Metadata = {
  title: "Travel Hub | بوابتك لعالم السفر",
  description: "وكالة Travel Hub للسفر والسياحة - نقدم لك أفضل أسعار حجز الطيران، الفنادق، وخدمات التأشيرات",
  generator: "v0.app",
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.className} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
