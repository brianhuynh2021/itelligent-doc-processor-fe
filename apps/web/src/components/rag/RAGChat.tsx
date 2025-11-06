"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { PanelRightClose, PanelRightOpen } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ChatInput } from "./ChatInput"
import { ContextPanel, DocumentSource } from "./ContextPanel"
import { Message, MessageBubble } from "./MessageBubble"

interface RAGChatProps {
  initialMessages?: Message[]
  initialSources?: DocumentSource[]
}

export function RAGChat({ initialMessages = [], initialSources = [] }: RAGChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [sources, setSources] = useState<DocumentSource[]>(initialSources)
  const [selectedSource, setSelectedSource] = useState<DocumentSource | null>(null)
  const [isContextOpen, setIsContextOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    // Simulate streaming response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Based on the documents you've provided, here's a comprehensive answer to your question about "${content}". 

The information suggests that the key points are well-documented in your source materials. Let me break this down:

1. **Primary Finding**: The documents contain relevant information that addresses your query.

2. **Supporting Evidence**: Multiple sources corroborate these findings.

3. **Recommendations**: Consider reviewing the cited documents for more detailed information.

Would you like me to elaborate on any specific aspect?`,
        citations: [
          {
            docId: "doc-1",
            docName: "Technical Documentation.pdf",
            chunkIndex: 3,
            text: "Sample citation text..."
          },
          {
            docId: "doc-2",
            docName: "Research Paper.pdf",
            chunkIndex: 7,
            text: "Another citation..."
          }
        ],
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      
      // Update sources if we have citations
      if (assistantMessage.citations) {
        const newSources: DocumentSource[] = assistantMessage.citations.map((citation) => ({
          id: citation.docId,
          name: citation.docName,
          type: "PDF",
          chunkIndex: citation.chunkIndex,
          preview: citation.text || "Preview text from document...",
          similarity: 0.85 + Math.random() * 0.1,
        }))
        setSources(newSources)
        if (newSources.length > 0) {
          setSelectedSource(newSources[0] || null)
        }
      }

      setIsLoading(false)
    }, 1500)
  }

  const handleCitationClick = (docId: string, chunkIndex: number) => {
    const source = sources.find(
      (s) => s.id === docId && s.chunkIndex === chunkIndex
    )
    if (source) {
      setSelectedSource(source)
      setIsContextOpen(true)
    }
  }

  return (
    <div className="flex h-[calc(100vh-80px)] relative">
      {/* Main Chat Area */}
      <div className={cn("flex flex-col flex-1 transition-all duration-300", isContextOpen && "lg:w-2/3")}>
        {/* Chat Messages */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="max-w-4xl mx-auto p-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="rounded-full bg-primary/10 p-6 mb-4">
                  <svg
                    className="h-12 w-12 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold mb-2">
                  Start a conversation
                </h2>
                <p className="text-muted-foreground max-w-md">
                  Ask questions about your documents and get AI-powered answers
                  with source citations.
                </p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onCitationClick={handleCitationClick}
                  />
                ))}
                {isLoading && (
                  <div className="flex gap-4 mb-6">
                    <div className="h-8 w-8 rounded-full bg-secondary shrink-0 flex items-center justify-center">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-card border rounded-lg p-4 shadow-sm">
                        <div className="flex gap-2">
                          <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" />
                          <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                          <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <ChatInput onSend={handleSend} isLoading={isLoading} />

        {/* Toggle Context Panel Button */}
        <div className="absolute bottom-20 right-4 lg:hidden z-10">
          <Button
            variant="outline"
            size="icon"
            className="shadow-lg"
            onClick={() => setIsContextOpen(!isContextOpen)}
          >
            {isContextOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Context Panel */}
      {isContextOpen && (
        <div className="hidden lg:block w-1/3 border-l bg-background animate-in slide-in-from-right duration-300">
          <ContextPanel
            sources={sources}
            selectedSource={selectedSource}
            onSelectSource={setSelectedSource}
            onClose={() => setIsContextOpen(false)}
            isOpen={isContextOpen}
          />
        </div>
      )}

      {/* Mobile Context Panel Overlay */}
      {isContextOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background animate-in fade-in duration-200">
          <ContextPanel
            sources={sources}
            selectedSource={selectedSource}
            onSelectSource={setSelectedSource}
            onClose={() => setIsContextOpen(false)}
            isOpen={isContextOpen}
          />
        </div>
      )}
      
      {/* Desktop Toggle Context Panel Button */}
      {sources.length > 0 && (
        <div className="hidden lg:block absolute top-4 right-4 z-10">
          <Button
            variant="outline"
            size="icon"
            className="shadow-lg"
            onClick={() => setIsContextOpen(!isContextOpen)}
          >
            {isContextOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

