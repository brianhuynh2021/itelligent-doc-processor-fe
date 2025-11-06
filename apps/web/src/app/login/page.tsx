"use client"

import { LoginForm } from "@/components/auth/LoginForm"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { useState } from "react"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (values: { email: string; password: string }) => {
    setIsLoading(true)
    try {
      // TODO: Replace with actual API call
      console.log("Login attempt:", values)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      
      // Simulate successful login
      // router.push("/dashboard")
    } catch (error) {
      console.error("Login error:", error)
      // TODO: Show error toast
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

