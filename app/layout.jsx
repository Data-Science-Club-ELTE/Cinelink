import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { NavBar } from "@/components/nav-bar"
import { Toaster } from "@/components/ui/toaster"
import { Providers } from "./providers"

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata = {
  title: "CineLink — Personalized Movie Recommendations",
  description: "Discover movies tailored to your taste. Rate, bookmark, and get smart recommendations.",
  generator: "v0.dev",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={plusJakarta.variable}>
      <body className="min-h-screen font-sans antialiased bg-background text-foreground">
        <Providers>
          <div className="min-h-screen flex flex-col">
            <NavBar />
            <main className="flex-grow">{children}</main>
            <footer className="py-8 mt-auto border-t border-border/60 bg-muted/30">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <p className="text-center text-sm text-muted-foreground">
                  © {new Date().getFullYear()} CineLink · Personalized recommendations
                </p>
              </div>
            </footer>
            <Toaster />
          </div>
        </Providers>
      </body>
    </html>
  )
}
