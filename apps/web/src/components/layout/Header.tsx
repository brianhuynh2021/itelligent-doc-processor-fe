"use client"

import { Button } from "@/components/ui/button"
import { CommandPaletteTrigger } from "@/components/ui/CommandPalette"
import {
  BarChart3,
  FileText,
  LogIn,
  Menu,
  MessageSquare,
  Shield,
} from "lucide-react"
import Link from "next/link"
import type { ComponentType } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "./Logo"
import { UserMenu } from "./UserMenu"
import { useHeaderSlots } from "./HeaderSlotsProvider"

type HeaderUser = {
  name?: string
  email?: string
  avatar?: string
}

export type HeaderNavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

interface HeaderProps {
  isAuthenticated?: boolean
  user?: HeaderUser
  onSignOut?: () => void
  navItems?: HeaderNavItem[]
}

const defaultNavItems: HeaderNavItem[] = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/dashboard", label: "Admin", icon: Shield },
]

export function Header({
  isAuthenticated = false,
  user,
  onSignOut,
  navItems = defaultNavItems,
}: HeaderProps) {
    const { slots } = useHeaderSlots()
    const pathname = usePathname()

    const isActive = (href: string) => {
      if (href === "/") return pathname === "/"
      if (href.startsWith("/admin")) return pathname.startsWith("/admin")
      return pathname === href || pathname.startsWith(`${href}/`)
    }

    return (
        <header
          className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50"
          style={{ height: "var(--app-header-height)" }}
        >
            <div className="container mx-auto flex h-full items-center justify-between px-4">
                <div className="flex items-center gap-4">
                  <Logo />
                  <div className="hidden md:flex items-center gap-3">
                    <CommandPaletteTrigger />
                    {slots.center}
                  </div>
                </div>
                
                {isAuthenticated ? (
                    <div className="flex items-center gap-3">
                      {slots.right}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
                            <Menu className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {navItems.map((item) => {
                            const Icon = item.icon
                            const active = isActive(item.href)
                            return (
                              <DropdownMenuItem key={item.href} asChild>
                                <Link
                                  href={item.href}
                                  className={cn(active && "bg-accent text-accent-foreground")}
                                >
                                  <Icon className="h-4 w-4" />
                                  <span>{item.label}</span>
                                </Link>
                              </DropdownMenuItem>
                            )
                          })}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href="/settings">
                              <span>Settings</span>
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <nav className="hidden md:flex items-center gap-6">
                          {navItems.map((item) => {
                            const Icon = item.icon
                            const active = isActive(item.href)
                            return (
                              <Link 
                                  key={item.href}
                                  href={item.href} 
                                  className={cn(
                                    "flex items-center gap-2 text-sm font-medium transition-colors",
                                    active
                                      ? "text-foreground"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                              >
                                  <Icon className="h-4 w-4" />
                                  {item.label}
                              </Link>
                            )
                          })}
                      </nav>
                      <UserMenu
                        {...(user ? { user } : {})}
                        {...(onSignOut ? { onSignOut } : {})}
                      />
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        {slots.right}
                        <nav className="flex items-center gap-4">
                        <Button variant="ghost" asChild>
                            <Link href="/login">
                                <LogIn className="h-4 w-4 mr-2" />
                                Sign in
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/register">
                                Get started
                            </Link>
                        </Button>
                        </nav>
                    </div>
                )}
            </div>
        </header>
    )
}