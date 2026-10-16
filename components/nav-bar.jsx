"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Menu, X, Film, Home, User, LogOut, LogIn, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function NavBar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()

  const routes = [
    { name: "Home", path: "/", icon: Home },
    { name: "All Movies", path: "/recommendations", icon: Film },
    { name: "Bookmarks", path: "/bookmarks", icon: Bookmark },
    { name: "Profile", path: "/profile", icon: User },
  ]

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  return (
    <nav className="sticky top-0 z-40 w-full bg-card/80 backdrop-blur-md border-b border-border/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 text-foreground hover:opacity-90 transition-opacity">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Film className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold tracking-tight">CineLink</span>
            </Link>
            <div className="hidden sm:flex sm:gap-1">
              {routes.map((route) => {
                const isActive = pathname === route.path
                return (
                  <Link
                    key={route.path}
                    href={route.path}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <route.icon className="h-4 w-4" />
                    {route.name}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="hidden sm:flex sm:items-center sm:gap-3">
            {session ? (
              <>
                <span className="text-sm text-muted-foreground max-w-[120px] truncate">
                  {session.user?.name}
                </span>
                <Button variant="outline" size="sm" onClick={handleSignOut} className="rounded-lg">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link href="/register">
                  <Button variant="ghost" size="sm" className="rounded-lg">Sign up</Button>
                </Link>
                <Link href="/login">
                  <Button size="sm" className="rounded-lg">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign in
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="-mr-2 flex items-center sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Main menu"
              aria-expanded={isOpen}
            >
              {isOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="sm:hidden border-t border-border/60 bg-card/95">
          <div className="py-2 space-y-0.5">
            {routes.map((route) => {
              const isActive = pathname === route.path
              return (
                <Link
                  key={route.path}
                  href={route.path}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg mx-2 transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <route.icon className="h-4 w-4" />
                  {route.name}
                </Link>
              )
            })}
          </div>
          <div className="pt-3 pb-3 border-t border-border/60">
            {session ? (
              <div className="px-4 space-y-3">
                <div className="text-sm font-medium">{session.user.name}</div>
                <div className="text-sm text-muted-foreground">{session.user.email}</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setIsOpen(false)
                    handleSignOut()
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="px-4 space-y-2">
                <Link href="/register" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">Sign up</Button>
                </Link>
                <Link href="/login" onClick={() => setIsOpen(false)}>
                  <Button variant="default" size="sm" className="w-full">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign in
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
