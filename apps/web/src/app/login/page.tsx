"use client"

import { LoginForm } from "@/components/auth/LoginForm"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { login, storeAuthTokens } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (values: { email: string; password: string }) => {
    setIsLoading(true)
    try {
      const data = await login(values)
      storeAuthTokens(data)
      toast.success("Signed in successfully")
      router.push("/admin/dashboard")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Login failed. Please try again."
      toast.error(message)
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
