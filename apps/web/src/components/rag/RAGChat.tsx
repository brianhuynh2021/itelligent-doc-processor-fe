'use client'

import { useHeaderSlots } from '@/components/layout/HeaderSlotsProvider'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { clearAuthTokens, getAccessToken, refreshAccessToken } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChatInput } from './ChatInput'
import { ContextPanel, DocumentSource } from './ContextPanel'
import {
  RAGDocumentOption,
  RAGCollectionOption,
  RAGHeaderControls,
  RAGSettings,
} from './RAGHeaderControls'
import { Message, MessageBubble } from './MessageBubble'

const RAG_COLLECTIONS: RAGCollectionOption[] = [
  { id: 'default', label: 'Default KB' },
  { id: 'product', label: 'Product Docs' },
  { id: 'policies', label: 'Company Policies' },
]

const STARTER_PROMPTS = [
  'Tóm tắt các điểm chính trong tài liệu quan trọng nhất.',
  'Liệt kê các yêu cầu và deadline có trong tài liệu.',
  'So sánh sự khác nhau giữa 2 tài liệu liên quan đến chính sách.',
  'Trích dẫn đoạn nguồn cho câu trả lời và giải thích ngắn gọn.',
]

interface RAGChatProps {
  initialMessages?: Message[]
  initialSources?: DocumentSource[]
}

type ChatContext = {
  text?: string
  score?: number
  metadata?: Record<string, unknown>
}

type ChatAskResponse = {
  answer?: string
  contexts?: ChatContext[]
  model?: string
  session_id?: number
  session_key?: string
}

type ChatHistoryItem = {
  id: number
  role: string
  content: string
  created_at: string
}

type ChatSessionResponse = {
  id: number
  session_key?: string
}

type DocumentListItem = {
  id: number
  name?: string | null
  original_filename?: string | null
  status?: string | null
}

type DocumentListResponse = {
  items: DocumentListItem[]
}

type DocumentStatusResponse = {
  id: number
  status?: string | null
}

type DocumentIngestResponse = {
  document?: {
    id?: number
    status?: string | null
  }
  chunks_indexed?: number
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return null
}

function extractDocumentId(metadata: Record<string, unknown>): number | null {
  const directKeys = ['document_id', 'documentId', 'doc_id', 'docId', 'id']
  for (const key of directKeys) {
    const found = toNumber(metadata[key])
    if (found != null) return found
  }

  const nestedDocument = metadata.document
  if (nestedDocument && typeof nestedDocument === 'object') {
    const found = toNumber((nestedDocument as { id?: unknown }).id)
    if (found != null) return found
  }

  const nestedMetadata = metadata.metadata
  if (nestedMetadata && typeof nestedMetadata === 'object') {
    const found = toNumber(
      (nestedMetadata as { document_id?: unknown }).document_id,
    )
    if (found != null) return found
  }

  return null
}

function extractChunkIndex(
  metadata: Record<string, unknown>,
  fallback: number,
): number {
  const candidates = [
    metadata.chunk_index,
    metadata.chunkIndex,
    metadata.chunk_id,
    metadata.chunkId,
    metadata.chunk,
  ]
  for (const candidate of candidates) {
    const value = toNumber(candidate)
    if (value != null) return value
  }
  return fallback
}

function extractDocumentName(
  metadata: Record<string, unknown>,
  documentId: number | null,
  fallback: number,
) {
  const keys = [
    'document_name',
    'document_original_filename',
    'file_name',
    'filename',
    'name',
    'title',
  ]
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  if (documentId != null) return `Document #${documentId}`
  return `Context ${fallback}`
}

function mapContextsToSources(
  contexts: ChatContext[] | undefined,
): DocumentSource[] {
  if (!Array.isArray(contexts)) return []

  return contexts.map((context, idx) => {
    const metadata =
      context.metadata && typeof context.metadata === 'object'
        ? context.metadata
        : {}
    const documentId = extractDocumentId(metadata)
    const chunkIndex = extractChunkIndex(metadata, idx + 1)
    const name = extractDocumentName(metadata, documentId, idx + 1)

    const typeValue = metadata.content_type
    const type =
      typeof typeValue === 'string' && typeValue.trim() ? typeValue : 'Document'

    const similarity =
      typeof context.score === 'number' && Number.isFinite(context.score)
        ? context.score
        : undefined

    const sourceId = `${documentId ?? 'doc'}-${chunkIndex}-${idx}`

    const source: DocumentSource = {
      id: sourceId,
      name,
      type,
      chunkIndex,
      preview:
        (typeof context.text === 'string' && context.text) ||
        (typeof metadata.text === 'string'
          ? metadata.text
          : 'No preview available.'),
      metadata,
    }

    if (documentId != null) source.documentId = documentId
    if (similarity != null) source.similarity = similarity

    return source
  })
}

function parseDate(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date()
  return date
}

function normalizeStatus(status: string | null | undefined): string {
  return status?.trim().toLowerCase() ?? ''
}

function isDocumentIndexed(status: string | null | undefined): boolean {
  const normalized = normalizeStatus(status)
  return ['completed', 'done', 'success', 'processed', 'indexed'].includes(
    normalized,
  )
}

function isDocumentProcessing(status: string | null | undefined): boolean {
  const normalized = normalizeStatus(status)
  return [
    'processing',
    'in_progress',
    'running',
    'ocr',
    'chunking',
    'ingesting',
    'embedding',
  ].includes(normalized)
}

function documentLabel(doc: DocumentListItem): string {
  return (
    (typeof doc.name === 'string' && doc.name.trim()) ||
    (typeof doc.original_filename === 'string' && doc.original_filename.trim()) ||
    `Document #${doc.id}`
  )
}

export function RAGChat({
  initialMessages = [],
  initialSources = [],
}: RAGChatProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const apiBaseUrl = useMemo(() => {
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
    return base?.replace(/\/+$/, '') ?? ''
  }, [])

  const scopedDocumentId = useMemo(() => {
    const raw = searchParams.get('document_id')
    if (!raw || !/^\d+$/.test(raw)) return null
    return Number(raw)
  }, [searchParams])

  const scopedCollectionId = useMemo(() => {
    const raw = searchParams.get('collection')
    if (!raw) return null
    return RAG_COLLECTIONS.some((collection) => collection.id === raw)
      ? raw
      : null
  }, [searchParams])

  const shouldStartFresh = useMemo(
    () => searchParams.get('new') === '1',
    [searchParams],
  )
  const shouldResumeSession = useMemo(
    () => searchParams.get('resume') === '1',
    [searchParams],
  )

  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    scopedDocumentId,
  )
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [sources, setSources] = useState<DocumentSource[]>(initialSources)
  const [selectedSource, setSelectedSource] = useState<DocumentSource | null>(
    null,
  )
  const [isContextOpen, setIsContextOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [documents, setDocuments] = useState<RAGDocumentOption[]>([])
  const [documentStatusById, setDocumentStatusById] = useState<
    Record<number, string>
  >({})

  const scrollRef = useRef<HTMLDivElement>(null)
  const scopeInitRef = useRef<string | null>(null)
  const { setSlot, clearSlot } = useHeaderSlots()

  const [settings, setSettings] = useState<RAGSettings>({
    collectionId: 'default',
    mode: 'semantic',
    topK: 8,
    minScore: 0,
    includeCitations: true,
    stream: false,
  })

  useEffect(() => {
    setSelectedDocumentId(scopedDocumentId)
  }, [scopedDocumentId])

  useEffect(() => {
    if (!scopedCollectionId) return
    setSettings((prev) =>
      prev.collectionId === scopedCollectionId
        ? prev
        : { ...prev, collectionId: scopedCollectionId },
    )
  }, [scopedCollectionId])

  useEffect(() => {
    if (!shouldStartFresh || typeof window === 'undefined') return
    const scopeKey = `${scopedDocumentId ?? ''}:${scopedCollectionId ?? ''}`
    if (scopeInitRef.current === scopeKey) return
    scopeInitRef.current = scopeKey

    setMessages([])
    setSources([])
    setSelectedSource(null)
    setSessionId(null)
    window.localStorage.removeItem('chat_session_id')
    window.localStorage.removeItem('chat_session_key')
  }, [scopedCollectionId, scopedDocumentId, shouldStartFresh])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (shouldStartFresh || scopedDocumentId != null || shouldResumeSession) return

    setMessages([])
    setSources([])
    setSelectedSource(null)
    setSessionId(null)
    window.localStorage.removeItem('chat_session_id')
    window.localStorage.removeItem('chat_session_key')
  }, [scopedDocumentId, shouldResumeSession, shouldStartFresh])

  useEffect(() => {
    if (getAccessToken()) return
    clearAuthTokens()
    router.replace('/login')
  }, [router])

  const authFetch = useCallback(
    async (
      url: string,
      init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> },
    ) => {
      const token = getAccessToken()
      if (!token) {
        clearAuthTokens()
        router.push('/login')
        throw new Error('You are not signed in.')
      }

      const doFetch = async (accessToken: string) => {
        const headers: Record<string, string> = {
          accept: 'application/json',
          ...init.headers,
          Authorization: `Bearer ${accessToken}`,
        }
        return fetch(url, { ...init, headers })
      }

      const first = await doFetch(token)
      if (first.status !== 401 && first.status !== 403) return first

      const nextToken = await refreshAccessToken()
      if (!nextToken) {
        clearAuthTokens()
        router.push('/login')
        throw new Error('Session expired. Please sign in again.')
      }

      return doFetch(nextToken)
    },
    [router],
  )

  const persistSession = useCallback((id: number, sessionKey?: string) => {
    setSessionId(id)
    localStorage.setItem('chat_session_id', String(id))
    if (sessionKey) {
      localStorage.setItem('chat_session_key', sessionKey)
    }
  }, [])

  const createSession = useCallback(async () => {
    if (!apiBaseUrl) return null
    const url = new URL('/api/v1/chat/sessions', apiBaseUrl)
    const res = await authFetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const message =
        body?.detail || body?.message || `Create session failed (${res.status}).`
      throw new Error(message)
    }

    const data = (await res
      .json()
      .catch(() => null)) as ChatSessionResponse | null
    if (!data?.id) {
      throw new Error('Unexpected response from chat sessions endpoint.')
    }
    persistSession(data.id, data.session_key)
    return data.id
  }, [apiBaseUrl, authFetch, persistSession])

  const loadSessionMessages = useCallback(
    async (targetSessionId: number) => {
      if (!apiBaseUrl) return
      const primary = new URL(
        `/api/v1/chat/sessions/${targetSessionId}/messages`,
        apiBaseUrl,
      )
      primary.searchParams.set('limit', '50')

      let res = await authFetch(primary.toString(), { method: 'GET' })
      if (res.status === 404) {
        const fallback = new URL('/api/v1/chat/history', apiBaseUrl)
        fallback.searchParams.set('session_id', String(targetSessionId))
        fallback.searchParams.set('limit', '50')
        res = await authFetch(fallback.toString(), { method: 'GET' })
      }

      if (!res.ok) return

      const data = (await res.json().catch(() => null)) as ChatHistoryItem[] | null
      if (!Array.isArray(data)) return

      setMessages(
        data
          .filter((item) => item && typeof item.content === 'string')
          .map((item) => ({
            id: String(item.id),
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: item.content,
            timestamp: parseDate(item.created_at),
          })),
      )
    },
    [apiBaseUrl, authFetch],
  )

  useEffect(() => {
    if (!apiBaseUrl) return
    const loadDocuments = async () => {
      try {
        const url = new URL('/api/v1/documents', apiBaseUrl)
        url.searchParams.set('skip', '0')
        url.searchParams.set('limit', '100')
        const res = await authFetch(url.toString(), { method: 'GET' })
        if (!res.ok) return
        const data = (await res
          .json()
          .catch(() => null)) as DocumentListResponse | null
        if (!data?.items || !Array.isArray(data.items)) return
        setDocuments(
          data.items.map((doc) => ({
            id: doc.id,
            label: documentLabel(doc),
          })),
        )
        setDocumentStatusById(
          data.items.reduce<Record<number, string>>((acc, doc) => {
            if (typeof doc.status === 'string' && doc.status.trim()) {
              acc[doc.id] = doc.status
            }
            return acc
          }, {}),
        )
      } catch {
        // Optional list for scope selector.
      }
    }
    void loadDocuments()
  }, [apiBaseUrl, authFetch])

  const ensureDocumentIndexedForChat = useCallback(
    async (documentId: number) => {
      if (!apiBaseUrl) {
        throw new Error(
          'Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.',
        )
      }

      const knownStatus = documentStatusById[documentId]
      if (isDocumentIndexed(knownStatus)) return

      const detailUrl = new URL(`/api/v1/documents/${documentId}`, apiBaseUrl)
      const detailRes = await authFetch(detailUrl.toString(), { method: 'GET' })
      if (!detailRes.ok) {
        const body = await detailRes.json().catch(() => ({}))
        const message =
          body?.detail ||
          body?.message ||
          `Failed to fetch document status (${detailRes.status}).`
        throw new Error(message)
      }

      const detail = (await detailRes
        .json()
        .catch(() => null)) as DocumentStatusResponse | null
      const latestStatus = detail?.status ?? null
      if (typeof latestStatus === 'string') {
        setDocumentStatusById((prev) => ({ ...prev, [documentId]: latestStatus }))
      }

      if (isDocumentIndexed(latestStatus)) return
      if (isDocumentProcessing(latestStatus)) {
        throw new Error(
          `Document #${documentId} đang xử lý (${latestStatus}). Hãy chờ ingest/index hoàn tất rồi thử lại.`,
        )
      }

      toast.info(`Document #${documentId} chưa index, đang auto-ingest...`)
      const ingestUrl = new URL(`/api/v1/documents/${documentId}/ingest`, apiBaseUrl)
      const ingestRes = await authFetch(ingestUrl.toString(), { method: 'POST' })
      if (!ingestRes.ok) {
        const body = await ingestRes.json().catch(() => ({}))
        const message =
          body?.detail ||
          body?.message ||
          `Ingest failed for Document #${documentId} (${ingestRes.status}).`
        throw new Error(message)
      }

      const ingestData = (await ingestRes
        .json()
        .catch(() => null)) as DocumentIngestResponse | null
      const statusAfterIngest = ingestData?.document?.status ?? 'completed'
      setDocumentStatusById((prev) => ({
        ...prev,
        [documentId]: statusAfterIngest,
      }))

      if (!isDocumentIndexed(statusAfterIngest)) {
        throw new Error(
          `Document #${documentId} ingest xong nhưng trạng thái vẫn là "${statusAfterIngest}".`,
        )
      }

      toast.success(`Document #${documentId} đã ingest xong, đang truy vấn lại.`)
    },
    [apiBaseUrl, authFetch, documentStatusById],
  )

  useEffect(() => {
    if (!apiBaseUrl) return
    if (shouldStartFresh || scopedDocumentId != null || !shouldResumeSession) return

    const raw = localStorage.getItem('chat_session_id')
    const parsed = raw && /^\d+$/.test(raw) ? Number(raw) : null
    if (!parsed) return

    persistSession(parsed)
    void loadSessionMessages(parsed)
  }, [
    apiBaseUrl,
    loadSessionMessages,
    persistSession,
    scopedDocumentId,
    shouldResumeSession,
    shouldStartFresh,
  ])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    setSlot(
      'right',
      <RAGHeaderControls
        sourcesCount={sources.length}
        isContextOpen={isContextOpen}
        onToggleContext={() => setIsContextOpen((v) => !v)}
        collections={RAG_COLLECTIONS}
        documents={documents}
        selectedDocumentId={selectedDocumentId}
        onChangeSelectedDocumentId={setSelectedDocumentId}
        settings={settings}
        onChangeSettings={setSettings}
      />,
    )

    return () => clearSlot('right')
  }, [
    clearSlot,
    documents,
    isContextOpen,
    selectedDocumentId,
    setSlot,
    settings,
    sources.length,
  ])

  const streamViaWebSocket = useCallback(
    async (question: string, ensuredSessionId: number) => {
      if (!apiBaseUrl) throw new Error('Missing API base URL.')
      if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
        throw new Error('WebSocket is not available in this environment.')
      }

      const wsUrl = new URL('/api/v1/chat/ws', apiBaseUrl)
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      wsUrl.searchParams.set('session_id', String(ensuredSessionId))
      wsUrl.searchParams.set('top_k', String(Math.max(1, Math.min(10, settings.topK))))
      wsUrl.searchParams.set('use_mmr', String(settings.mode === 'hybrid'))
      wsUrl.searchParams.set('mmr_lambda', '0.5')
      wsUrl.searchParams.set('max_history_messages', '10')
      if (settings.minScore > 0) {
        wsUrl.searchParams.set('score_threshold', String(settings.minScore))
      }
      const token = getAccessToken()
      if (token) {
        wsUrl.searchParams.set('token', token)
      }

      return new Promise<string>((resolve, reject) => {
        const socket = new WebSocket(wsUrl.toString())
        let answer = ''
        let done = false
        let idleTimer: number | null = null
        let hardTimeout: number | null = null

        const finish = () => {
          if (done) return
          done = true
          if (idleTimer != null) window.clearTimeout(idleTimer)
          if (hardTimeout != null) window.clearTimeout(hardTimeout)
          socket.close()
          resolve(answer.trim())
        }

        const fail = (message: string) => {
          if (done) return
          done = true
          if (idleTimer != null) window.clearTimeout(idleTimer)
          if (hardTimeout != null) window.clearTimeout(hardTimeout)
          socket.close()
          reject(new Error(message))
        }

        const resetIdle = () => {
          if (idleTimer != null) window.clearTimeout(idleTimer)
          idleTimer = window.setTimeout(() => {
            finish()
          }, 900)
        }

        hardTimeout = window.setTimeout(() => {
          if (answer.trim()) {
            finish()
            return
          }
          fail('WebSocket chat timed out.')
        }, 30000)

        socket.onopen = () => {
          socket.send(question)
        }
        socket.onmessage = (event) => {
          if (typeof event.data === 'string') {
            answer += event.data
            resetIdle()
          }
        }
        socket.onerror = () => {
          fail('WebSocket chat failed.')
        }
        socket.onclose = () => {
          if (done) return
          if (answer.trim()) {
            finish()
            return
          }
          fail('WebSocket chat closed without response.')
        }
      })
    },
    [apiBaseUrl, settings.minScore, settings.mode, settings.topK],
  )

  const handleSend = async (content: string) => {
    if (!apiBaseUrl) {
      toast.error(
        'Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.',
      )
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      if (selectedDocumentId != null) {
        await ensureDocumentIndexedForChat(selectedDocumentId)
      }

      const ensuredSessionId = sessionId ?? (await createSession())
      if (!ensuredSessionId) {
        throw new Error('Unable to create chat session.')
      }

      const scoreThreshold =
        settings.minScore > 0 ? settings.minScore : undefined

      const requestBody = {
        question: content,
        session_id: ensuredSessionId,
        top_k: Math.max(1, Math.min(10, settings.topK)),
        score_threshold: scoreThreshold,
        use_mmr: settings.mode === 'hybrid',
        filters:
          selectedDocumentId != null
            ? {
                document_id: selectedDocumentId,
              }
            : undefined,
        stream: false,
      }

      if (settings.stream && selectedDocumentId == null) {
        try {
          const streamedAnswer = await streamViaWebSocket(content, ensuredSessionId)
          if (!streamedAnswer) throw new Error('No response from WebSocket stream.')

          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-assistant`,
              role: 'assistant',
              content: streamedAnswer,
              timestamp: new Date(),
            },
          ])
          return
        } catch {
          // Fallback to HTTP JSON response path below.
        }
      }

      const aliasUrl = new URL('/api/v1/chat', apiBaseUrl)
      let res = await authFetch(aliasUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      if (res.status === 404) {
        const askUrl = new URL('/api/v1/chat/ask', apiBaseUrl)
        res = await authFetch(askUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...requestBody, stream: false }),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const message =
          (typeof err?.detail === 'string' && err.detail) ||
          (typeof err?.message === 'string' && err.message) ||
          `Chat request failed (${res.status}).`
        throw new Error(message)
      }

      const data = (await res
        .json()
        .catch(() => null)) as ChatAskResponse | null
      const answer = data?.answer
      if (typeof answer !== 'string' || !answer.trim()) {
        throw new Error('Unexpected response from chat endpoint.')
      }

      if (typeof data?.session_id === 'number') {
        persistSession(data.session_id, data.session_key)
      }

      const nextSources = mapContextsToSources(data?.contexts)
      setSources(nextSources)
      setSelectedSource((prev) => prev ?? nextSources[0] ?? null)

      if (selectedDocumentId != null && nextSources.length === 0) {
        toast.warning(
          `Document #${selectedDocumentId} chưa có ngữ cảnh truy xuất được. Hãy kiểm tra ingest/index hoặc giảm Min score.`,
        )
      }

      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: answer,
        citations: nextSources.map((source) => ({
          docId: source.id,
          docName: source.name,
          chunkIndex: source.chunkIndex,
          text: source.preview,
        })),
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to get answer from server.'
      toast.error(message)

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          content: `Xin lỗi, mình chưa xử lý được yêu cầu này. Chi tiết lỗi: ${message}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCitationClick = (sourceId: string, chunkIndex: number) => {
    const source = sources.find(
      (s) => s.id === sourceId && s.chunkIndex === chunkIndex,
    )
    if (source) {
      setSelectedSource(source)
      setIsContextOpen(true)
    }
  }

  return (
    <div className="relative flex h-[calc(100vh-var(--app-header-height))]">
      <div
        className={cn(
          'flex flex-1 flex-col transition-all duration-300',
          isContextOpen && 'lg:w-2/3',
        )}
      >
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="mx-auto max-w-4xl p-6">
            {selectedDocumentId != null && (
              <div className="bg-muted/50 mb-4 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <p className="text-muted-foreground">
                  Scoped to <span className="text-foreground">Document #{selectedDocumentId}</span>
                  {settings.collectionId ? (
                    <>
                      {' '}
                      in{' '}
                      <span className="text-foreground">
                        {RAG_COLLECTIONS.find((c) => c.id === settings.collectionId)?.label ??
                          settings.collectionId}
                      </span>
                    </>
                  ) : null}
                  .
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDocumentId(null)
                    router.replace('/chat')
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <div className="bg-primary/10 mb-4 rounded-full p-6">
                  <svg
                    className="text-primary h-12 w-12"
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
                <h2 className="mb-2 text-2xl font-semibold">
                  Start a conversation
                </h2>
                <p className="text-muted-foreground max-w-md">
                  Ask questions about your documents and get AI-powered answers
                  with source citations.
                </p>
                <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((p) => (
                    <Button
                      key={p}
                      variant="outline"
                      className="h-auto justify-start whitespace-normal text-left"
                      onClick={() => {
                        void handleSend(p)
                      }}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
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
                  <div className="mb-6 flex gap-4">
                    <div className="bg-secondary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                      <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-card rounded-lg border p-4 shadow-sm">
                        <div className="flex gap-2">
                          <div className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full" />
                          <div className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full [animation-delay:0.2s]" />
                          <div className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <ChatInput
          onSend={(message) => {
            void handleSend(message)
          }}
          isLoading={isLoading}
        />

        <div className="absolute bottom-20 right-4 z-10 lg:hidden">
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

      {isContextOpen && (
        <div className="bg-background animate-in slide-in-from-right hidden w-1/3 border-l duration-300 lg:block">
          <ContextPanel
            sources={sources}
            selectedSource={selectedSource}
            onSelectSource={setSelectedSource}
            onClose={() => setIsContextOpen(false)}
            onOpenDocument={(documentId) => {
              router.push(`/documents/${documentId}`)
            }}
            isOpen={isContextOpen}
          />
        </div>
      )}

      {isContextOpen && (
        <div className="bg-background animate-in fade-in fixed inset-0 z-50 duration-200 lg:hidden">
          <ContextPanel
            sources={sources}
            selectedSource={selectedSource}
            onSelectSource={setSelectedSource}
            onClose={() => setIsContextOpen(false)}
            onOpenDocument={(documentId) => {
              router.push(`/documents/${documentId}`)
            }}
            isOpen={isContextOpen}
          />
        </div>
      )}

      {sources.length > 0 && (
        <div className="absolute right-4 top-4 z-10 hidden lg:block">
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
