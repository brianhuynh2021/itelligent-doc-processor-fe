"use client"

import { LoginForm } from "@/components/auth/LoginForm"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { refreshAuthUser, storeAuthTokens } from "@/lib/auth"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL

  const handleLogin = async (values: { email: string; password: string }) => {
    setIsLoading(true)
    try {
      if (!baseUrl) {
        throw new Error(
          "Missing API base URL. Set NEXT_PUBLIC_BASE_URL (e.g. http://localhost:8000) and restart the dev server.",
        )
      }

      const loginUrl = new URL("/api/v1/auth/login-json", baseUrl).toString()

      const res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const message =
          err?.detail || err?.message || `Login failed (${res.status})`
        throw new Error(message)
      }

      const data = await res.json().catch(() => ({}))
      const accessToken = data?.access_token ?? data?.accessToken
      const refreshToken = data?.refresh_token ?? data?.refreshToken

      if (!accessToken) {
        throw new Error("Login succeeded but response is missing access_token.")
      }

      storeAuthTokens({ accessToken, refreshToken })
      await refreshAuthUser()

      toast.success("Signed in successfully")
      router.push("/chat")
    } catch (error) {
      console.error("Login error:", error)
      toast.error(error instanceof Error ? error.message : "Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    // TODO: Implement Google OAuth
    console.log("Google login clicked")
  }

  const handleGitHubLogin = () => {
    // TODO: Implement GitHub OAuth
    console.log("GitHub login clicked")
  }

  return (
    <AuthLayout>
      <LoginForm
        onSubmit={handleLogin}
        onGoogleLogin={handleGoogleLogin}
        onGitHubLogin={handleGitHubLogin}
        isLoading={isLoading}
      />
    </AuthLayout>
  )
}
