import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Hiboo OS",
  description: "Hiboo Operation System",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="nl" className={`${inter.variable} h-full`}>
      <body className="min-h-full antialiased">
        <Sidebar />
        <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
          <div className="px-6 lg:px-8 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
