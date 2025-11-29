"use client"

import { ReactNode, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { AUTH_CHANGED_EVENT, hasAuthSession } from "@/lib/auth"

interface ProtectedRouteProps {
  children: ReactNode
  redirectTo?: string
  requireAuth?: boolean
}

export function ProtectedRoute({
  children,
  redirectTo = "/login",
  requireAuth = true,
}: ProtectedRouteProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkSession = () => {
      const sessionExists = hasAuthSession()
      setIsAuthenticated(sessionExists)
      setIsLoading(false)

      if (requireAuth && !sessionExists) {
        router.replace(redirectTo)
      }
    }

    checkSession()
    window.addEventListener("storage", checkSession)
    window.addEventListener(AUTH_CHANGED_EVENT, checkSession)

    return () => {
      window.removeEventListener("storage", checkSession)
      window.removeEventListener(AUTH_CHANGED_EVENT, checkSession)
    }
  }, [requireAuth, redirectTo, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (requireAuth && !isAuthenticated) {
    return null // Will redirect
  }

  return <>{children}</>
}
