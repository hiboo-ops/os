import type { Metadata } from "next"
import { Barlow, Barlow_Condensed } from "next/font/google"
import "./globals.css"
import { AppShell } from "@/components/app-shell"

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-barlow",
})

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-barlow-condensed",
})

export const metadata: Metadata = {
  title: "Hiboo OS",
  description: "Hiboo Operating System",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="nl" className={`${barlow.variable} ${barlowCondensed.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
