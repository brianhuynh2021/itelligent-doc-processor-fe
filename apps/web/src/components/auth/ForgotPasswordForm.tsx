"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

interface ForgotPasswordFormProps {
  onSubmit?: (values: ForgotPasswordFormValues) => Promise<void> | void
  isLoading?: boolean
}

export function ForgotPasswordForm({
  onSubmit,
  isLoading = false,
}: ForgotPasswordFormProps) {
  const [isSuccess, setIsSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState("")

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  const handleSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      await onSubmit?.(values)
      setSubmittedEmail(values.email)
      setIsSuccess(true)
    } catch {
      // Error handling is done by the parent component
    }
  }

  if (isSuccess) {
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Check your email</h1>
          <p className="text-muted-foreground">
            We&apos;ve sent a password reset link to
          </p>
          <p className="font-medium">{submittedEmail}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">What to do next:</p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Check your inbox for an email from us</li>
                <li>Click the password reset link in the email</li>
                <li>Create a new password for your account</li>
              </ol>
              <div className="pt-4 border-t">
                <p className="text-xs">
                  Didn&apos;t receive the email? Check your spam folder or{" "}
                  <button
                    onClick={() => {
                      setIsSuccess(false)
                      form.reset()
                    }}
                    className="text-primary hover:underline"
                  >
                    try again
                  </button>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-primary hover:underline"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Forgot password?</h1>
        <p className="text-muted-foreground">
          No worries, we&apos;ll send you reset instructions
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...field}
                      type="email"
                      placeholder="name@example.com"
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Enter the email address associated with your account
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      </Form>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}

