"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Search as SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { clearAuthTokens, getAccessToken, refreshAccessToken } from "@/lib/auth"

type DocumentInDB = {
  id: number
  name: string
  original_filename: string
  content_type: string
  status: string
  processing_progress: number
  updated_at: string
}

type SearchFilter = {
  document_id?: number | null
  owner_id?: number | null
  content_type?: string | null
  created_from?: string | null
  created_to?: string | null
}

type SearchRequest = {
  query: string
  top_k?: number
  fetch_k?: number | null
  score_threshold?: number | null
  use_mmr?: boolean
  mmr_lambda?: number
  filters?: SearchFilter | null
}

type SearchResult = {
  id: unknown
  score: number
  text?: string | null
  payload: Record<string, unknown>
}

type SearchResponse = {
  results: SearchResult[]
  used_mmr: boolean
  total_candidates: number
}

function getDocumentLabel(document: DocumentInDB) {
  return document.name || document.original_filename || `Document #${document.id}`
}

function extractDocumentId(payload: Record<string, unknown>): number | null {
  const candidates = [
    payload.document_id,
    payload.documentId,
    payload.doc_id,
    payload.docId,
  ]
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value)
  }

  const doc = payload.document
  if (doc && typeof doc === "object") {
    const id = (doc as { id?: unknown }).id
    if (typeof id === "number" && Number.isFinite(id)) return id
    if (typeof id === "string" && /^\d+$/.test(id)) return Number(id)
  }

  const metadata = payload.metadata
  if (metadata && typeof metadata === "object") {
    const id = (metadata as { document_id?: unknown }).document_id
    if (typeof id === "number" && Number.isFinite(id)) return id
    if (typeof id === "string" && /^\d+$/.test(id)) return Number(id)
  }

  return null
}

function scoreBadgeVariant(score: number): "default" | "secondary" | "outline" {
  if (score >= 0.8) return "default"
  if (score >= 0.5) return "secondary"
  return "outline"
}

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const apiBaseUrl = useMemo(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
    return baseUrl?.replace(/\/+$/, "") ?? ""
  }, [])

  const initialQuery = searchParams.get("q") ?? ""
  const initialDocumentId = searchParams.get("document_id")
  const initialDocumentIdNumber =
    initialDocumentId && /^\d+$/.test(initialDocumentId)
      ? Number(initialDocumentId)
      : null

  const [query, setQuery] = useState(initialQuery)
  const [topK, setTopK] = useState(5)
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    initialDocumentIdNumber,
  )

  const [documents, setDocuments] = useState<DocumentInDB[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)

  const [results, setResults] = useState<SearchResult[]>([])
  const [usedMmr, setUsedMmr] = useState<boolean | null>(null)
  const [totalCandidates, setTotalCandidates] = useState<number | null>(null)

  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError(
        "Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.",
      )
      return
    }

    try {
      const url = new URL("/api/v1/documents", apiBaseUrl)
      url.searchParams.set("skip", "0")
      url.searchParams.set("limit", "100")

      const res = await authFetch(url.toString(), { method: "GET" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message =
          body?.detail || body?.message || `Failed to load documents (${res.status}).`
        throw new Error(message)
      }

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
        return
      }

      throw new Error("Unexpected response from server.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.")
    } finally {
      setIsLoadingDocuments(false)
    }
  }, [apiBaseUrl, authFetch])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const runSearch = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    if (!apiBaseUrl) {
      setError(
        "Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.",
      )
      return
    }

    setIsSearching(true)
    setError(null)
    setResults([])
    setUsedMmr(null)
    setTotalCandidates(null)

    const request: SearchRequest = {
      query: trimmed,
      top_k: topK,
      filters:
        selectedDocumentId != null ? { document_id: selectedDocumentId } : null,
    }

    try {
      const url = new URL("/api/v1/search", apiBaseUrl)
      const res = await authFetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message = body?.detail || body?.message || `Search failed (${res.status}).`
        throw new Error(message)
      }

      const data = (await res.json().catch(() => null)) as SearchResponse | null
      if (!data?.results || !Array.isArray(data.results)) {
        throw new Error("Unexpected response from server.")
      }

      setResults(data.results)
      setUsedMmr(Boolean(data.used_mmr))
      setTotalCandidates(
        typeof data.total_candidates === "number" ? data.total_candidates : null,
      )
      toast.success(`Found ${data.results.length} result(s)`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed."
      setError(message)
      toast.error(message)
    } finally {
      setIsSearching(false)
    }
  }, [apiBaseUrl, authFetch, query, selectedDocumentId, topK])

  return (
    <div className="container mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Search</h1>
        <p className="text-muted-foreground">
          Semantic search across your ingested documents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Query</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="search-query">Search</Label>
              <div className="flex gap-2">
                <Input
                  id="search-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask something, e.g. “What are the key responsibilities?”"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return
                    e.preventDefault()
                    void runSearch()
                  }}
                />
                <Button
                  type="button"
                  className="gap-2"
                  disabled={isSearching || !query.trim()}
                  onClick={runSearch}
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SearchIcon className="h-4 w-4" />
                  )}
                  Search
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="search-scope">Scope</Label>
              <select
                id="search-scope"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
                    {getDocumentLabel(doc)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {isLoadingDocuments ? "Loading documents…" : "Filter results to a single document."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="search-topk">Top K</Label>
              <Input
                id="search-topk"
                type="number"
                min={1}
                max={50}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
              />
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!results.length}
                onClick={() => {
                  setResults([])
                  setUsedMmr(null)
                  setTotalCandidates(null)
                  setError(null)
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Error</p>
              <p className="text-destructive/90 break-words">{error}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Results</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {usedMmr != null ? (
              <Badge variant="outline">{usedMmr ? "MMR" : "No MMR"}</Badge>
            ) : null}
            {totalCandidates != null ? (
              <span>{totalCandidates} candidates</span>
            ) : null}
            <span>{results.length} shown</span>
          </div>
        </CardHeader>
        <CardContent>
          {isSearching ? (
            <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Run a search to see results. Make sure the documents have been ingested.
            </p>
          ) : (
            <div className="space-y-3">
              {results.map((result, index) => {
                const documentIdFromPayload = extractDocumentId(result.payload)
                const snippet =
                  typeof result.text === "string" && result.text.trim()
                    ? result.text.trim()
                    : null
                const score = typeof result.score === "number" ? result.score : 0

                return (
                  <Card
                    key={`${String(result.id)}-${index}`}
                    className="p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={scoreBadgeVariant(score)}>
                            Score {score.toFixed(3)}
                          </Badge>
                          {documentIdFromPayload != null ? (
                            <Badge variant="secondary">
                              Document #{documentIdFromPayload}
                            </Badge>
                          ) : null}
                        </div>

                        {snippet ? (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {snippet}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No text snippet returned.
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {documentIdFromPayload != null ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              router.push(`/documents/${documentIdFromPayload}`)
                            }
                          >
                            Open document
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted-foreground">
                        View payload
                      </summary>
                      <ScrollArea className="mt-2 h-40 rounded-md border p-3">
                        <pre className="text-xs whitespace-pre-wrap break-words">
                          {JSON.stringify(result.payload, null, 2)}
                        </pre>
                      </ScrollArea>
                    </details>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
