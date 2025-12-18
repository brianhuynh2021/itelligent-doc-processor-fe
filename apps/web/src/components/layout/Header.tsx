"use client"

import { Button } from "@/components/ui/button"
import { CommandPaletteTrigger } from "@/components/ui/CommandPalette"
import { BarChart3, FileText, LogIn, MessageSquare } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { MouseEvent } from "react"
import { Logo } from "./Logo"
import { UserMenu } from "./UserMenu"
import {
    ACCESS_TOKEN_KEY,
    AUTH_CHANGED_EVENT,
    clearAuthTokens,
    getAuthUser,
    getStoredAuthUser,
    hasAuthSession,
} from "@/lib/auth"

export function Header() {
    const router = useRouter()
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [user, setUser] = useState<{ name?: string; email?: string } | null>(
        null
    )

    useEffect(() => {
        const sync = () => {
            const authed = hasAuthSession()
            setIsAuthenticated(authed)
            setUser(authed ? (getStoredAuthUser() ?? getAuthUser()) : null)
        }
        sync()

        const onStorage = (event: StorageEvent) => {
            if (event.key === ACCESS_TOKEN_KEY || event.key === null) sync()
        }

        window.addEventListener(AUTH_CHANGED_EVENT, sync)
        window.addEventListener("storage", onStorage)
        return () => {
            window.removeEventListener(AUTH_CHANGED_EVENT, sync)
            window.removeEventListener("storage", onStorage)
        }
    }, [])

    const handleSignOut = (event?: MouseEvent) => {
        const trusted =
            event?.nativeEvent && "isTrusted" in event.nativeEvent
                ? Boolean((event.nativeEvent as { isTrusted?: boolean }).isTrusted)
                : false

        if (event && !trusted) return

        clearAuthTokens()
        toast.success("Signed out")
        router.push("/login")
    }

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="container mx-auto flex items-center justify-between py-4 px-4">
                <Logo />
                
                {isAuthenticated ? (
                    <nav className="hidden md:flex items-center gap-6">
                        <CommandPaletteTrigger />
                        <Link 
                            href="/chat" 
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <MessageSquare className="h-4 w-4" />
                            Chat
                        </Link>
                        <Link 
                            href="/documents" 
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <FileText className="h-4 w-4" />
                            Documents
                        </Link>
                        <Link 
                            href="/admin/dashboard" 
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <BarChart3 className="h-4 w-4" />
                            Dashboard
                        </Link>
                        <UserMenu
                            {...(user ? { user } : {})}
                            onSignOut={handleSignOut}
                        />
                    </nav>
                ) : (
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
                )}
            </div>
        </header>
    )
}
