"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { CitationBadge } from "./CitationBadge"
import { User, Bot, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Array<{
    docId: string
    docName: string
    chunkIndex: number
    text: string
  }>
  timestamp: Date
  isStreaming?: boolean
}

interface MessageBubbleProps {
  message: Message
  onCitationClick?: (docId: string, chunkIndex: number) => void
}

export function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-4 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500", {
      "flex-row-reverse": isUser,
    })}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn({
          "bg-primary text-primary-foreground": isUser,
          "bg-secondary": !isUser,
        })}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex-1 space-y-2", {
        "items-end": isUser,
      })}>
        <Card className={cn("p-4 max-w-[85%] shadow-sm", {
          "bg-primary text-primary-foreground ml-auto": isUser,
          "bg-card": !isUser,
        })}>
          <div className={cn("prose prose-sm max-w-none", {
            "prose-invert": isUser,
            "prose-neutral": !isUser,
          })}>
            <div className="whitespace-pre-wrap break-words">
              {message.content}
              {message.isStreaming && (
                <Loader2 className="inline-block h-4 w-4 ml-2 animate-spin" />
              )}
            </div>
          </div>
        </Card>

        {message.citations && message.citations.length > 0 && !isUser && (
          <div className="flex flex-wrap gap-2">
            {message.citations.map((citation, idx) => (
              <CitationBadge
                key={idx}
                docName={citation.docName}
                chunkIndex={citation.chunkIndex}
                onClick={() => onCitationClick?.(citation.docId, citation.chunkIndex)}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

