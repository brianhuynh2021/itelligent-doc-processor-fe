"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Loader2, RefreshCw, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/ui/EmptyState"
import { ErrorDisplay } from "@/components/ui/ErrorDisplay"
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton"
import { getAccessToken, refreshAccessToken } from "@/lib/auth"

type DocumentItem = {
  id?: number | string
  name?: string
  filename?: string
  original_filename?: string
  title?: string
  status?: string
  created_at?: string
  updated_at?: string
  inserted_at?: string
  file_size?: number
  content_type?: string
  processing_progress?: number
  processing_step?: string | null
  tags?: string[]
  [key: string]: unknown
}

type PaginatedDocumentsResponse = {
  items: DocumentItem[]
  total: number
}

type UploadFileResponse = {
  file_id: string
  filename: string
  content_type: string
  size: number
  url: string
  document_id: number
}

function getDocumentLabel(document: DocumentItem) {
  return (
    document.name ||
    document.title ||
    document.original_filename ||
    document.filename ||
    (document.id != null ? `Document #${document.id}` : "Untitled document")
  )
}

function getUpdatedAt(document: DocumentItem) {
  return (
    document.updated_at ||
    document.inserted_at ||
    document.created_at ||
    null
  )
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

const TERMINAL_STATUSES = new Set([
  "ready",
  "done",
  "completed",
  "success",
  "failed",
  "error",
])

function normalizeStatus(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function getDisplayStatus(document: DocumentItem) {
  const statusValue = typeof document.status === "string" ? document.status.trim() : ""
  const stepValue =
    typeof document.processing_step === "string"
      ? document.processing_step.trim()
      : ""
  if (!statusValue && !stepValue) return "—"
  if (!stepValue) return statusValue || "—"

  const normalized = normalizeStatus(statusValue)
  if (TERMINAL_STATUSES.has(normalized)) return statusValue || "—"

  return stepValue
}

export default function DocumentsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [skip, setSkip] = useState(0)
  const [limit] = useState(20)

  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  const apiBaseUrl = useMemo(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
    return baseUrl?.replace(/\/+$/, "") ?? ""
  }, [])

  const resetUploadState = useCallback(() => {
    setSelectedFile(null)
    setUploadError(null)
    setIsUploading(false)
    setIsDragActive(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const setFile = useCallback((file: File | null) => {
    setUploadError(null)
    setSelectedFile(file)
  }, [])

  const loadDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setTotal(null)

    let token = getAccessToken()
    if (!token) {
      setIsLoading(false)
      setError("You are not signed in.")
      router.push("/login")
      return
    }

    if (!apiBaseUrl) {
      setIsLoading(false)
      setError(
        "Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.",
      )
      return
    }

    const url = new URL("/api/v1/documents", apiBaseUrl)
    url.searchParams.set("skip", String(skip))
    url.searchParams.set("limit", String(limit))

    try {
      let res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.status === 401 || res.status === 403) {
        const nextToken = await refreshAccessToken()
        if (nextToken) {
          token = nextToken
          res = await fetch(url.toString(), {
            method: "GET",
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          })
        } else {
          router.push("/login")
          throw new Error("Session expired. Please sign in again.")
        }
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message =
          body?.detail || body?.message || `Failed to load documents (${res.status}).`
        throw new Error(message)
      }

      const data = (await res.json().catch(() => null)) as unknown
      if (Array.isArray(data)) {
        setDocuments(data as DocumentItem[])
        return
      }

      if (
        data &&
        typeof data === "object" &&
        "items" in data &&
        Array.isArray((data as PaginatedDocumentsResponse).items)
      ) {
        const typed = data as PaginatedDocumentsResponse
        setDocuments(typed.items)
        setTotal(typeof typed.total === "number" ? typed.total : null)
        return
      }

      throw new Error(
        "Unexpected response from server (expected an array or { items, total }).",
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.")
    } finally {
      setIsLoading(false)
    }
  }, [apiBaseUrl, limit, router, skip])

  const uploadDocument = useCallback(async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadError(null)

    let token = getAccessToken()
    if (!token) {
      setIsUploading(false)
      setUploadError("You are not signed in.")
      router.push("/login")
      return
    }

    if (!apiBaseUrl) {
      setIsUploading(false)
      setUploadError(
        "Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.",
      )
      return
    }

    const url = new URL("/api/v1/files/upload", apiBaseUrl)
    const body = new FormData()
    body.append("file", selectedFile)

    try {
      let res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
      })
      if (res.status === 401 || res.status === 403) {
        const nextToken = await refreshAccessToken()
        if (nextToken) {
          token = nextToken
          res = await fetch(url.toString(), {
            method: "POST",
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            body,
          })
        } else {
          router.push("/login")
          throw new Error("Session expired. Please sign in again.")
        }
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const message =
          err?.detail || err?.message || `Upload failed (${res.status}).`
        throw new Error(message)
      }

      const data = (await res
        .json()
        .catch(() => null)) as UploadFileResponse | null

      toast.success(
        data?.filename ? `Uploaded ${data.filename}` : "Uploaded successfully",
      )

      if (data?.document_id != null) {
        setIsUploadOpen(false)
        resetUploadState()
        router.push(`/documents/${data.document_id}`)
        return
      }

      setIsUploadOpen(false)
      resetUploadState()
      if (skip === 0) {
        void loadDocuments()
      } else {
        setSkip(0)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload document."
      setUploadError(message)
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }, [apiBaseUrl, loadDocuments, resetUploadState, router, selectedFile, skip])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const filteredDocuments = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return documents
    return documents.filter((document) =>
      getDocumentLabel(document).toLowerCase().includes(trimmed),
    )
  }, [documents, query])

  return (
    <div className="container mx-auto px-4 py-10 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            Browse and manage your uploaded documents
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog
            open={isUploadOpen}
            onOpenChange={(open) => {
              setIsUploadOpen(open)
              if (open) resetUploadState()
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <UploadCloud className="h-4 w-4" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload document</DialogTitle>
                <DialogDescription>
                  Upload a single file (PDF, DOCX, images, CSV, TXT).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="document-upload">File</Label>
                <input
                  id="document-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg,.csv,.txt"
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null)
                  }}
                />
                <div
                  className={[
                    "w-full overflow-hidden rounded-md border p-4 transition-colors",
                    selectedFile ? "bg-muted/10" : "border-dashed",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25",
                  ].join(" ")}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!isUploading) setIsDragActive(true)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!isUploading) setIsDragActive(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragActive(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragActive(false)
                    if (isUploading) return
                    const file = e.dataTransfer.files?.[0] ?? null
                    if (file) setFile(file)
                  }}
                >
                  {!selectedFile ? (
                    <button
                      type="button"
                      disabled={isUploading}
                      className="flex w-full flex-col items-center justify-center gap-2 rounded-md py-6 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="h-6 w-6" />
                      <span>
                        Drop a file here or{" "}
                        <span className="font-medium underline underline-offset-4">
                          browse
                        </span>
                      </span>
                      <span className="text-xs">
                        PDF, DOCX, images (PNG/JPEG), CSV, TXT
                      </span>
                    </button>
                  ) : (
                    <div className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-md border bg-background p-3">
                      <div className="rounded-md bg-muted p-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 w-0 flex-1">
                        <p
                          className="truncate text-sm font-medium"
                          title={selectedFile.name}
                        >
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Math.max(1, Math.round(selectedFile.size / 1024))} KB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {uploadError ? (
                  <p className="text-sm text-destructive">{uploadError}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!selectedFile || isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change file
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!selectedFile || isUploading}
                    onClick={() => resetUploadState()}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isUploading}
                    onClick={() => {
                      setIsUploadOpen(false)
                      resetUploadState()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={uploadDocument}
                    disabled={!selectedFile || isUploading}
                    className="gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading
                      </>
                    ) : (
                      "Upload"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="gap-2" onClick={loadDocuments}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Your documents</CardTitle>
              <CardDescription>
                Showing {filteredDocuments.length} of {total ?? documents.length}
              </CardDescription>
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents..."
              className="md:w-80"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSkeleton variant="table" count={6} />
          ) : error ? (
            <ErrorDisplay message={error} onRetry={loadDocuments} />
          ) : filteredDocuments.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8 text-muted-foreground" />}
              title="No documents yet"
              description="Upload a document in the backend (or add an upload flow here) and it will appear in this list."
            />
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((document, index) => {
                      const label = getDocumentLabel(document)
                      const updatedAt = getUpdatedAt(document)
                      const displayStatus = getDisplayStatus(document)
                      const stepValue =
                        typeof document.processing_step === "string"
                          ? document.processing_step.trim()
                          : ""
                      const normalizedStatus = normalizeStatus(document.status)
                      const progress =
                        typeof document.processing_progress === "number"
                          ? document.processing_progress
                          : null
                      const showProgress =
                        Boolean(stepValue) &&
                        displayStatus === stepValue &&
                        progress != null &&
                        !TERMINAL_STATUSES.has(normalizedStatus)

                      const key =
                        document.id != null
                          ? String(document.id)
                          : `${label}-${index}`
                      const hasId = document.id != null

                      return (
                        <TableRow
                          key={key}
                          className={
                            hasId
                              ? "cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                              : undefined
                          }
                          tabIndex={hasId ? 0 : -1}
                          onKeyDown={(e) => {
                            if (!hasId) return
                            if (e.key !== "Enter") return
                            router.push(`/documents/${String(document.id)}`)
                          }}
                          onClick={() => {
                            if (!hasId) return
                            router.push(`/documents/${String(document.id)}`)
                          }}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <div className="rounded-md bg-muted p-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate">{label}</p>
                                {document.original_filename &&
                                document.original_filename !== label ? (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {document.original_filename}
                                  </p>
                                ) : document.filename && document.filename !== label ? (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {document.filename}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {displayStatus !== "—" ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{displayStatus}</Badge>
                                {showProgress ? (
                                  <span className="text-xs text-muted-foreground">
                                    {progress}%
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {formatDateTime(updatedAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  disabled={skip === 0}
                  onClick={() => setSkip((s) => Math.max(0, s - limit))}
                >
                  Previous
                </Button>
                <p className="text-sm text-muted-foreground">
                  Page {Math.floor(skip / limit) + 1}
                  {typeof total === "number" ? ` • ${total} total` : ""}
                </p>
                <Button
                  variant="outline"
                  disabled={
                    typeof total === "number"
                      ? skip + limit >= total
                      : documents.length < limit
                  }
                  onClick={() => setSkip((s) => s + limit)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
