"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { CommandPaletteTrigger } from "@/components/ui/CommandPalette"
import { BarChart3, FileText, LogIn, MessageSquare, Shield } from "lucide-react"
import Link from "next/link"
import { Logo } from "./Logo"
import { UserMenu } from "./UserMenu"
import { AUTH_CHANGED_EVENT, clearAuthTokens, hasAuthSession } from "@/lib/auth"
import { useRouter } from "next/navigation"

export function Header() {
    const router = useRouter()
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    useEffect(() => {
        const syncAuthState = () => setIsAuthenticated(hasAuthSession())

        syncAuthState()
        window.addEventListener("storage", syncAuthState)
        window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState)

        return () => {
            window.removeEventListener("storage", syncAuthState)
            window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState)
        }
    }, [])

    const handleSignOut = () => {
        clearAuthTokens()
        setIsAuthenticated(false)
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
                            href="/dashboard" 
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <BarChart3 className="h-4 w-4" />
                            Dashboard
                        </Link>
                        <Link 
                            href="/admin/dashboard" 
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Shield className="h-4 w-4" />
                            Admin
                        </Link>
                        <UserMenu
                            user={{
                                name: "John Doe",
                                email: "john@example.com",
                            }}
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
