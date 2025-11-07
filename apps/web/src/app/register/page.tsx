"use client"

import { RegisterForm } from "@/components/auth/RegisterForm"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { useState } from "react"

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleRegister = async (values: {
    name: string
    email: string
    password: string
  }) => {
    setIsLoading(true)
    try {
      // TODO: Replace with actual API call
      console.log("Register attempt:", values)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      
      // Simulate successful registration
      // router.push("/dashboard")
    } catch (error) {
      console.error("Register error:", error)
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
      <RegisterForm
        onSubmit={handleRegister}
        onGoogleLogin={handleGoogleLogin}
        onGitHubLogin={handleGitHubLogin}
        isLoading={isLoading}
      />
    </AuthLayout>
  )
}

