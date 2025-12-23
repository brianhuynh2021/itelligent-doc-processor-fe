"use client"

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  ScanText,
  SplitSquareVertical,
  Trash2,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { clearAuthTokens, getAccessToken, refreshAccessToken } from "@/lib/auth"

type DocumentInDB = {
  id: number
  name: string
  original_filename: string
  file_path: string
  file_size: number
  content_type: string
  owner_id: number
  status: string
  processing_step: string | null
  processing_progress: number
  text_content: string | null
  processing_started_at: string | null
  processing_completed_at: string | null
  processing_duration_ms: number | null
  error_count: number
  last_error: string | null
  download_count: number
  last_accessed_at: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at: string | null
}

type IngestionStep = {
  name: string
  duration_ms: number
  detail?: string | null
}

type IngestionResponse = {
  document: DocumentInDB
  total_duration_ms: number
  chunks_indexed: number
  steps: IngestionStep[]
}

function formatDateTime(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  const normalized = status.trim().toLowerCase()
  if (["ready", "done", "completed", "success"].includes(normalized)) return "default"
  if (["failed", "error"].includes(normalized)) return "outline"
  return "secondary"
}

function documentLabel(document: DocumentInDB) {
  return (
    document.name ||
    document.original_filename ||
    (document.id != null ? `Document #${document.id}` : "Document")
  )
}

function isTerminalStatus(document: DocumentInDB) {
  const normalized = document.status.trim().toLowerCase()
  if (["ready", "done", "completed", "success", "failed", "error"].includes(normalized)) {
    return true
  }
  if (document.processing_completed_at) return true
  if (document.processing_progress >= 100) return true
  return false
}

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const router = useRouter()
  const pollIntervalRef = useRef<number | null>(null)
  const pollTicksRef = useRef(0)

  const [document, setDocument] = useState<DocumentInDB | null>(null)
  const [ingestion, setIngestion] = useState<IngestionResponse | null>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "text">("overview")

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<
    null | "refresh" | "ocr" | "chunk" | "ingest" | "delete"
  >(null)

  const [chunkSize, setChunkSize] = useState(1000)
  const [chunkOverlap, setChunkOverlap] = useState(200)

  const apiBaseUrl = useMemo(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
    return baseUrl?.replace(/\/+$/, "") ?? ""
  }, [])

  const resolvedParams = use(params)

  const documentId = useMemo(() => {
    const parsed = Number(resolvedParams.documentId)
    return Number.isFinite(parsed) ? parsed : null
  }, [resolvedParams.documentId])

  const stopPolling = useCallback(() => {
    if (typeof window === "undefined") return
    if (pollIntervalRef.current == null) return
    window.clearInterval(pollIntervalRef.current)
    pollIntervalRef.current = null
    pollTicksRef.current = 0
  }, [])

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

  const loadDocument = useCallback(async () => {
    if (documentId == null) {
      setIsLoading(false)
      setError("Invalid document id.")
      return
    }

    if (!apiBaseUrl) {
      setIsLoading(false)
      setError(
        "Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.",
      )
      return
    }

    setError(null)
    const url = new URL(`/api/v1/documents/${documentId}`, apiBaseUrl)

    try {
      const res = await authFetch(url.toString(), { method: "GET" })

      if (!res.ok) {
        if (res.status === 503) {
          const body = await res.json().catch(() => ({}))
          const message =
            body?.detail ||
            body?.message ||
            "Service unavailable (503). Check backend workers/dependencies."
          throw new Error(message)
        }
        const body = await res.json().catch(() => ({}))
        const message =
          body?.detail || body?.message || `Failed to load document (${res.status}).`
        throw new Error(message)
      }

      const data = (await res.json().catch(() => null)) as DocumentInDB | null
      if (!data?.id) throw new Error("Unexpected response from server.")

      setDocument(data)
      if (isTerminalStatus(data)) stopPolling()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document.")
    } finally {
      setIsLoading(false)
    }
  }, [apiBaseUrl, authFetch, documentId, stopPolling])

  const startPolling = useCallback(() => {
    if (typeof window === "undefined") return
    stopPolling()
    pollTicksRef.current = 0
    pollIntervalRef.current = window.setInterval(() => {
      pollTicksRef.current += 1
      if (pollTicksRef.current > 120) {
        stopPolling()
        return
      }
      void loadDocument()
    }, 2500)
  }, [loadDocument, stopPolling])

  useEffect(() => {
    void loadDocument()
  }, [loadDocument])

  useEffect(() => stopPolling, [stopPolling])

  const runOcr = useCallback(async () => {
    if (documentId == null) return
    if (!apiBaseUrl) return

    setAction("ocr")
    setError(null)

    try {
      const url = new URL(`/api/v1/documents/${documentId}/ocr`, apiBaseUrl)
      const res = await authFetch(url.toString(), { method: "POST" })

      if (!res.ok) {
        if (res.status === 503) {
          const body = await res.json().catch(() => ({}))
          const message =
            body?.detail ||
            body?.message ||
            "Service unavailable (503). Check backend workers/dependencies."
          throw new Error(message)
        }
        const body = await res.json().catch(() => ({}))
        const message = body?.detail || body?.message || `OCR failed (${res.status}).`
        throw new Error(message)
      }

      const updated = (await res.json().catch(() => null)) as DocumentInDB | null
      if (updated?.id) setDocument(updated)
      toast.success("OCR started")
      startPolling()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start OCR."
      setError(message)
      toast.error(message)
    } finally {
      setAction(null)
    }
  }, [apiBaseUrl, authFetch, documentId, startPolling])

  const runChunk = useCallback(async () => {
    if (documentId == null) return
    if (!apiBaseUrl) return

    setAction("chunk")
    setError(null)

    try {
      const url = new URL(`/api/v1/documents/${documentId}/chunk`, apiBaseUrl)
      url.searchParams.set("chunk_size", String(chunkSize))
      url.searchParams.set("chunk_overlap", String(chunkOverlap))

      const res = await authFetch(url.toString(), { method: "POST" })

      if (!res.ok) {
        if (res.status === 503) {
          const body = await res.json().catch(() => ({}))
          const message =
            body?.detail ||
            body?.message ||
            "Service unavailable (503). Check backend workers/dependencies."
          throw new Error(message)
        }
        const body = await res.json().catch(() => ({}))
        const message =
          body?.detail || body?.message || `Chunking failed (${res.status}).`
        throw new Error(message)
      }

      const chunks = (await res.json().catch(() => null)) as unknown
      const count = Array.isArray(chunks) ? chunks.length : null
      toast.success(count != null ? `Created ${count} chunks` : "Chunking complete")
      startPolling()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to chunk document."
      setError(message)
      toast.error(message)
    } finally {
      setAction(null)
    }
  }, [apiBaseUrl, authFetch, chunkOverlap, chunkSize, documentId, startPolling])

  const runIngest = useCallback(async () => {
    if (documentId == null) return
    if (!apiBaseUrl) return

    setAction("ingest")
    setError(null)
    setIngestion(null)

    try {
      const url = new URL(`/api/v1/documents/${documentId}/ingest`, apiBaseUrl)
      url.searchParams.set("chunk_size", String(chunkSize))
      url.searchParams.set("chunk_overlap", String(chunkOverlap))

      const res = await authFetch(url.toString(), { method: "POST" })

      if (!res.ok) {
        if (res.status === 503) {
          const body = await res.json().catch(() => ({}))
          const message =
            body?.detail ||
            body?.message ||
            "Service unavailable (503). Check backend workers/dependencies."
          throw new Error(message)
        }
        const body = await res.json().catch(() => ({}))
        const message =
          body?.detail || body?.message || `Ingest failed (${res.status}).`
        throw new Error(message)
      }

      const data = (await res
        .json()
        .catch(() => null)) as IngestionResponse | null

      if (!data?.document?.id) throw new Error("Unexpected response from server.")

      setIngestion(data)
      setDocument(data.document)
      toast.success(`Ingested (${data.chunks_indexed} chunks indexed)`)
      startPolling()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to ingest document."
      setError(message)
      toast.error(message)
    } finally {
      setAction(null)
    }
  }, [apiBaseUrl, authFetch, chunkOverlap, chunkSize, documentId, startPolling])

  const deleteDocument = useCallback(async () => {
    if (documentId == null) return
    if (!apiBaseUrl) return

    setAction("delete")
    setError(null)

    try {
      const url = new URL(`/api/v1/documents/${documentId}`, apiBaseUrl)
      const res = await authFetch(url.toString(), { method: "DELETE" })

      if (!res.ok) {
        if (res.status === 503) {
          const body = await res.json().catch(() => ({}))
          const message =
            body?.detail ||
            body?.message ||
            "Service unavailable (503). Check backend workers/dependencies."
          throw new Error(message)
        }
        const body = await res.json().catch(() => ({}))
        const message =
          body?.detail || body?.message || `Delete failed (${res.status}).`
        throw new Error(message)
      }

      toast.success("Document deleted")
      router.push("/documents")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete document."
      setError(message)
      toast.error(message)
    } finally {
      setAction(null)
    }
  }, [apiBaseUrl, authFetch, documentId, router])

  const busy = action != null
  const label = document ? documentLabel(document) : "Document"
  const status = document?.status ?? "—"
  const progressValue = document?.processing_progress ?? 0

  return (
    <div className="container mx-auto px-4 py-10 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            className="gap-2 w-fit"
            onClick={() => router.push("/documents")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold truncate">{label}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(status)}>{status}</Badge>
              {document?.processing_step ? (
                <Badge variant="outline">{document.processing_step}</Badge>
              ) : null}
              {document ? (
                <span className="text-sm text-muted-foreground">
                  {document.processing_progress}%
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={busy}
            onClick={async () => {
              setAction("refresh")
              await loadDocument()
              setAction(null)
            }}
          >
            {action === "refresh" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={busy || !document}
            onClick={runOcr}
          >
            {action === "ocr" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanText className="h-4 w-4" />
            )}
            OCR
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={busy || !document}
            onClick={runIngest}
          >
            {action === "ingest" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Ingest
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            disabled={busy || !document}
            onClick={deleteDocument}
          >
            {action === "delete" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading document…
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : null}

      {document ? (
        <Card>
          <CardHeader>
            <CardTitle>Processing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {document.processing_step ? `Step: ${document.processing_step}` : "Step: —"}
                </span>
                <span>{document.processing_progress}%</span>
              </div>
              <Progress value={progressValue} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">Started</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(document.processing_started_at)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Completed</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(document.processing_completed_at)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Duration</p>
                <p className="text-sm text-muted-foreground">
                  {document.processing_duration_ms != null
                    ? `${document.processing_duration_ms} ms`
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Errors</p>
                <p className="text-sm text-muted-foreground">{document.error_count}</p>
              </div>
            </div>

            {document.last_error ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">Last error</p>
                <p className="text-destructive/90 break-words">{document.last_error}</p>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Chunking settings</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="chunk-size">Chunk size</Label>
                    <Input
                      id="chunk-size"
                      type="number"
                      min={200}
                      max={4000}
                      step={50}
                      value={chunkSize}
                      disabled={busy}
                      onChange={(e) => setChunkSize(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="chunk-overlap">Overlap</Label>
                    <Input
                      id="chunk-overlap"
                      type="number"
                      min={0}
                      max={1000}
                      step={10}
                      value={chunkOverlap}
                      disabled={busy}
                      onChange={(e) => setChunkOverlap(Number(e.target.value))}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={busy}
                  onClick={runChunk}
                >
                  {action === "chunk" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SplitSquareVertical className="h-4 w-4" />
                  )}
                  Chunk
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Metadata</p>
                <div className="rounded-md border p-3 text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="text-foreground">Type:</span> {document.content_type}
                  </p>
                  <p>
                    <span className="text-foreground">Size:</span>{" "}
                    {Math.max(1, Math.round(document.file_size / 1024))} KB
                  </p>
                  <p>
                    <span className="text-foreground">Created:</span>{" "}
                    {formatDateTime(document.created_at)}
                  </p>
                  <p>
                    <span className="text-foreground">Updated:</span>{" "}
                    {formatDateTime(document.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {document ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {ingestion ? (
              <Card>
                <CardHeader>
                  <CardTitle>Last ingestion</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2 text-muted-foreground">
                    <span>
                      Total:{" "}
                      <span className="text-foreground">
                        {ingestion.total_duration_ms} ms
                      </span>
                    </span>
                    <span>
                      Indexed:{" "}
                      <span className="text-foreground">
                        {ingestion.chunks_indexed}
                      </span>
                    </span>
                  </div>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-3 border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <span>Step</span>
                      <span>Duration</span>
                      <span>Detail</span>
                    </div>
                    <div className="divide-y">
                      {ingestion.steps.map((step, idx) => (
                        <div
                          key={`${step.name}-${idx}`}
                          className="grid grid-cols-3 gap-3 px-3 py-2"
                        >
                          <span className="font-medium">{step.name}</span>
                          <span className="text-muted-foreground">
                            {step.duration_ms} ms
                          </span>
                          <span
                            className="text-muted-foreground truncate"
                            title={step.detail ?? ""}
                          >
                            {step.detail ?? "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Run <span className="text-foreground font-medium">Ingest</span>{" "}
                  to do OCR → chunk → embed → store.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="text">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Extracted text</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!document.text_content}
                  onClick={async () => {
                    if (!document.text_content) return
                    await navigator.clipboard.writeText(document.text_content)
                    toast.success("Copied extracted text")
                  }}
                >
                  Copy
                </Button>
              </CardHeader>
              <CardContent>
                {!document.text_content ? (
                  <p className="text-sm text-muted-foreground">
                    No extracted text yet. Run OCR or Ingest.
                  </p>
                ) : (
                  <ScrollArea className="h-96 rounded-md border p-3">
                    <pre className="whitespace-pre-wrap break-words text-sm">
                      {document.text_content}
                    </pre>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}
