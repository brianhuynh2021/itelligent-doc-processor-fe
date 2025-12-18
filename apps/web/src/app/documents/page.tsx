"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, RefreshCw } from "lucide-react"

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
import { EmptyState } from "@/components/ui/EmptyState"
import { ErrorDisplay } from "@/components/ui/ErrorDisplay"
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton"
import { getAccessToken } from "@/lib/auth"

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
  tags?: string[]
  [key: string]: unknown
}

type PaginatedDocumentsResponse = {
  items: DocumentItem[]
  total: number
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

export default function DocumentsPage() {
  const router = useRouter()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [skip, setSkip] = useState(0)
  const [limit] = useState(20)

  const apiBaseUrl = useMemo(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
    return baseUrl?.replace(/\/+$/, "") ?? ""
  }, [])

  const loadDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setTotal(null)

    const token = getAccessToken()
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
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.status === 401) {
        router.push("/login")
        throw new Error("Session expired. Please sign in again.")
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
                      const status =
                        typeof document.status === "string"
                          ? document.status
                          : "—"

                      const key =
                        document.id != null
                          ? String(document.id)
                          : `${label}-${index}`

                      return (
                        <TableRow key={key}>
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
                            {status !== "—" ? (
                              <Badge variant="secondary">{status}</Badge>
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
