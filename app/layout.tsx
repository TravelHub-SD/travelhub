import type React from "react"
import type { Metadata } from "next"
import { Cairo } from "next/font/google"
import Script from "next/script"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

// Google Analytics 4 — يعمل تلقائياً عند ضبط NEXT_PUBLIC_GA_ID في Vercel
const GA_ID = process.env.NEXT_PUBLIC_GA_ID

const cairo = Cairo({ subsets: ["arabic", "latin"] })

const SITE_URL = "https://travelhub-sd.com"
const SITE_NAME = "Travel Hub | ترافل هب"
const SITE_DESC =
  "ترافل هب (Travel Hub) — وكالة سفر سودانية: احجز رحلات طيران بدر وتاركو وسودانير بأسعار حيّة بالجنيه السوداني، فنادق حول العالم، تأشيرات سياحية، وباقات عمرة. ادفع بسهولة عبر واتساب."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Travel Hub ترافل هب | حجز طيران وفنادق وتأشيرات من السودان",
    template: "%s | Travel Hub ترافل هب",
  },
  description: SITE_DESC,
  keywords: [
    "ترافل هب",
    "Travel Hub",
    "TravelHub Sudan",
    "حجز طيران السودان",
    "تذاكر طيران الخرطوم",
    "بدر للطيران",
    "تاركو للطيران",
    "سودانير",
    "تأشيرات السودان",
    "حجز فنادق",
    "وكالة سفر سودانية",
  ],
  applicationName: "Travel Hub",
  authors: [{ name: "Travel Hub", url: SITE_URL }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Travel Hub ترافل هب | حجز طيران وفنادق وتأشيرات من السودان",
    description: SITE_DESC,
    locale: "ar_SD",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Travel Hub ترافل هب" }],
  },
  twitter: {
    card: "summary",
    title: "Travel Hub ترافل هب",
    description: SITE_DESC,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
}

// بيانات منظّمة (Schema.org) — تعرّف جوجل ومساعدي الذكاء الاصطناعي بالوكالة
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: "Travel Hub",
  alternateName: ["ترافل هب", "TravelHub Sudan"],
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: SITE_DESC,
  email: "travelhub.sd@gmail.com",
  telephone: "+249114610204",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Khartoum",
    addressCountry: "SD",
  },
  areaServed: "SD",
  sameAs: ["https://wa.me/249960278594"],
  priceRange: "SDG",
  knowsLanguage: ["ar", "en"],
  makesOffer: [
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "حجز تذاكر طيران" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "حجز فنادق" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "تأشيرات سياحية" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "باقات عمرة" } },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.className} antialiased`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
        <Analytics />
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
