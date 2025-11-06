"use client"

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { useState } from "react"

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (values: { email: string }) => {
    setIsLoading(true)
    try {
      // TODO: Replace with actual API call
      console.log("Forgot password request:", values)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      
      // Success is handled by the form component
    } catch (error) {
      console.error("Forgot password error:", error)
      // TODO: Show error toast
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout>
      <ForgotPasswordForm onSubmit={handleSubmit} isLoading={isLoading} />
    </AuthLayout>
  )
}

