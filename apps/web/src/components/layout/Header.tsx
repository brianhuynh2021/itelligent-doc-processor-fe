"use client"

import { Button } from "@/components/ui/button"
import { CommandPaletteTrigger } from "@/components/ui/CommandPalette"
import { BarChart3, FileText, LogIn, MessageSquare, Shield } from "lucide-react"
import Link from "next/link"
import type { ComponentType } from "react"
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
                      <nav className="hidden md:flex items-center gap-6">
                          {navItems.map((item) => {
                            const Icon = item.icon
                            return (
                              <Link 
                                  key={item.href}
                                  href={item.href} 
                                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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