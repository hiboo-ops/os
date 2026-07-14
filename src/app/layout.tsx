import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"

const inter = Inter({ subsets: ["latin"] })

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
    <html lang="nl" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-800">
        <Sidebar />
        <main className="md:ml-64 min-h-screen pt-14 md:pt-0">
          <div className="px-6 lg:px-10 py-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
