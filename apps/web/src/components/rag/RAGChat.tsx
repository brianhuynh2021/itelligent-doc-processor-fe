"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { clearAuthTokens, getAccessToken, refreshAccessToken } from "@/lib/auth"
import { PanelRightClose, PanelRightOpen, PlusCircle } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChatInput } from "./ChatInput"
import { ContextPanel, DocumentSource } from "./ContextPanel"
import { Message, MessageBubble } from "./MessageBubble"

interface RAGChatProps {
  initialMessages?: Message[]
  initialSources?: DocumentSource[]
}

type SearchFilter = {
  document_id?: number | null
  owner_id?: number | null
  content_type?: string | null
  created_from?: string | null
  created_to?: string | null
}

type ContextChunk = {
  text: string
  score: number
  metadata: Record<string, unknown>
}

type ChatRequest = {
  question: string
  session_id?: number | null
  stream?: boolean
  filters?: SearchFilter | null
  top_k?: number
  score_threshold?: number | null
  use_mmr?: boolean
  mmr_lambda?: number
  max_context_chars?: number
  max_history_messages?: number
  model?: string | null
}

type ChatResponse = {
  answer: string
  model: string
  contexts: ContextChunk[]
  session_id: number
  session_key: string
}

type DocumentInDB = {
  id: number
  name: string
  original_filename: string
}

const CHAT_SESSION_ID_KEY = "chat_session_id"
const CHAT_SESSION_KEY_KEY = "chat_session_key"

function extractDocumentId(metadata: Record<string, unknown>): number | null {
  const candidates = [
    metadata.document_id,
    metadata.documentId,
    metadata.doc_id,
    metadata.docId,
  ]
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value)
  }
  return null
}

function extractChunkIndex(metadata: Record<string, unknown>): number | null {
  const candidates = [metadata.chunk_index, metadata.chunkIndex, metadata.index]
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value)
  }
  return null
}

function extractDocumentName(metadata: Record<string, unknown>, documentId: number | null) {
  const candidates = [
    metadata.document_name,
    metadata.doc_name,
    metadata.filename,
    metadata.file_name,
    metadata.original_filename,
    metadata.name,
    metadata.title,
  ]
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return documentId != null ? `Document #${documentId}` : "Document"
}

function extractContentType(metadata: Record<string, unknown>) {
  const candidates = [metadata.content_type, metadata.contentType, metadata.type]
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return "Document"
}

export function RAGChat({ initialMessages = [], initialSources = [] }: RAGChatProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [sources, setSources] = useState<DocumentSource[]>(initialSources)
  const [selectedSource, setSelectedSource] = useState<DocumentSource | null>(null)
  const [isContextOpen, setIsContextOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const apiBaseUrl = useMemo(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
    return baseUrl?.replace(/\/+$/, "") ?? ""
  }, [])

  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DocumentInDB[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null)

  const authFetch = useCallback(
    async (
      url: string,
      init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
    ) => {
      const token = getAccessToken()
      if (!token) {
        clearAuthTokens()
        router.push("/login")
        throw new Error("You are not signed in.")
      }

      const doFetch = async (accessToken: string) => {
        const headers: Record<string, string> = {
          accept: "application/json",
          ...init.headers,
          Authorization: `Bearer ${accessToken}`,
        }
        return fetch(url, { ...init, headers })
      }

      const res = await doFetch(token)
      if (res.status !== 401 && res.status !== 403) return res

      const nextToken = await refreshAccessToken()
      if (!nextToken) {
        clearAuthTokens()
        router.push("/login")
        throw new Error("Session expired. Please sign in again.")
      }

      return doFetch(nextToken)
    },
    [router],
  )

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocuments(true)
    if (!apiBaseUrl) {
      setIsLoadingDocuments(false)
      return
    }

    try {
      const url = new URL("/api/v1/documents", apiBaseUrl)
      url.searchParams.set("skip", "0")
      url.searchParams.set("limit", "100")

      const res = await authFetch(url.toString(), { method: "GET" })
      if (!res.ok) return

      const data = (await res.json().catch(() => null)) as unknown
      if (data && typeof data === "object" && "items" in data) {
        const items = (data as { items?: unknown }).items
        if (Array.isArray(items)) {
          setDocuments(items as DocumentInDB[])
          return
        }
      }
      if (Array.isArray(data)) {
        setDocuments(data as DocumentInDB[])
      }
    } catch {
      // Ignore (authFetch already redirects on auth errors).
    } finally {
      setIsLoadingDocuments(false)
    }
  }, [apiBaseUrl, authFetch])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedSessionId = localStorage.getItem(CHAT_SESSION_ID_KEY)
    if (storedSessionId && /^\d+$/.test(storedSessionId)) {
      setSessionId(Number(storedSessionId))
    }
    const storedSessionKey = localStorage.getItem(CHAT_SESSION_KEY_KEY)
    if (storedSessionKey) setSessionKey(storedSessionKey)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (sessionId != null) localStorage.setItem(CHAT_SESSION_ID_KEY, String(sessionId))
    if (sessionId == null) localStorage.removeItem(CHAT_SESSION_ID_KEY)
  }, [sessionId])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (sessionKey) localStorage.setItem(CHAT_SESSION_KEY_KEY, sessionKey)
    if (!sessionKey) localStorage.removeItem(CHAT_SESSION_KEY_KEY)
  }, [sessionKey])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const resetChat = useCallback(() => {
    setMessages([])
    setSources([])
    setSelectedSource(null)
    setSessionId(null)
    setSessionKey(null)
    toast.success("Started a new chat")
  }, [])

  const handleSend = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      if (!apiBaseUrl) {
        throw new Error(
          "Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.",
        )
      }

      const url = new URL("/api/v1/chat/ask", apiBaseUrl)
      const request: ChatRequest = {
        question: content,
        session_id: sessionId,
        stream: false,
        filters: selectedDocumentId != null ? { document_id: selectedDocumentId } : null,
      }

      const res = await authFetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message = body?.detail || body?.message || `Chat failed (${res.status}).`
        throw new Error(message)
      }

      const data = (await res.json().catch(() => null)) as ChatResponse | null
      if (!data?.answer) throw new Error("Unexpected response from server.")

      setSessionId(data.session_id ?? null)
      setSessionKey(data.session_key ?? null)

      const contextSources: DocumentSource[] = (Array.isArray(data.contexts) ? data.contexts : [])
        .map((context, index) => {
          const metadata = context?.metadata && typeof context.metadata === "object" ? context.metadata : {}
          const documentIdFromMetadata = extractDocumentId(metadata)
          const chunkIndex = extractChunkIndex(metadata) ?? index
          const name = extractDocumentName(metadata, documentIdFromMetadata)
          const source: DocumentSource = {
            id: `${documentIdFromMetadata ?? "unknown"}:${chunkIndex}:${index}`,
            name,
            type: extractContentType(metadata),
            chunkIndex,
            preview: context.text,
            similarity: context.score,
            metadata,
            ...(documentIdFromMetadata != null
              ? { documentId: documentIdFromMetadata }
              : {}),
          }
          return source
        })
        .filter((s) => Boolean(s.preview))

      const citations = contextSources.map((source) => ({
        docId: source.id,
        docName: source.name,
        chunkIndex: source.chunkIndex,
        text: source.preview,
      }))

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        ...(citations.length ? { citations } : {}),
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      setSources(contextSources)
      setSelectedSource(contextSources[0] ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat failed."
      toast.error(message)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: message,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } finally {
      setIsLoading(false)
    }
  }, [apiBaseUrl, authFetch, selectedDocumentId, sessionId])

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
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
          <div className="max-w-4xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Scope</span>
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                disabled={isLoadingDocuments}
                value={selectedDocumentId ?? ""}
                onChange={(e) => {
                  const value = e.target.value
                  setSelectedDocumentId(value ? Number(value) : null)
                }}
              >
                <option value="">All documents</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name || doc.original_filename || `Document #${doc.id}`}
                  </option>
                ))}
              </select>
              {sessionId != null ? (
                <span className="text-xs text-muted-foreground">
                  Session #{sessionId}
                </span>
              ) : null}
            </div>

            <Button
              type="button"
              variant="outline"
              className="gap-2 w-fit"
              onClick={resetChat}
              disabled={isLoading}
            >
              <PlusCircle className="h-4 w-4" />
              New chat
            </Button>
          </div>
        </div>

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
            onOpenDocument={(documentId) => router.push(`/documents/${documentId}`)}
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
            onOpenDocument={(documentId) => router.push(`/documents/${documentId}`)}
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
