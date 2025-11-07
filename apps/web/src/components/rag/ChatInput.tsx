"use client"

import { useState, KeyboardEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Send, Paperclip, Loader2 } from "lucide-react"

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading?: boolean
  placeholder?: string
  disabled?: boolean
}

export function ChatInput({ 
  onSend, 
  isLoading = false, 
  placeholder = "Ask a question about your documents...",
  disabled = false
}: ChatInputProps) {
  const [message, setMessage] = useState("")

  const handleSend = () => {
    if (message.trim() && !isLoading && !disabled) {
      onSend(message.trim())
      setMessage("")
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={disabled}
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <div className="flex-1 relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className="min-h-[60px] max-h-[200px] resize-none pr-12"
            rows={1}
          />
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>

        <Button
          onClick={handleSend}
          disabled={!message.trim() || isLoading || disabled}
          size="icon"
          className="shrink-0 h-[60px] w-[60px]"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  )
}

