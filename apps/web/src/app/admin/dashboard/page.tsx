"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  Activity,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
} from "lucide-react"

import { AdminLayout } from "@/components/admin/AdminLayout"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorDisplay } from "@/components/ui/ErrorDisplay"
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton"
import { clearAuthTokens, getAccessToken, refreshAccessToken } from "@/lib/auth"

type DocumentsStatsResponse = {
  total: number
  by_status: Record<string, number>
  by_content_type?: Record<string, number>
  updated_last_24h?: number
}

type ChatStatsResponse = {
  total_sessions: number
  total_messages: number
  messages_last_24h: number
  active_sessions_last_24h: number
}

type ChatSessionItem = {
  id: number
  session_key: string
  name?: string | null
  created_by_user_id?: number | null
  created_at: string
  updated_at: string
}

type DocumentListItem = {
  id: number
  status?: string
  content_type?: string
  updated_at?: string
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

function normalizeStatusCounts(input: Record<string, number>) {
  const normalized: Record<string, number> = {}
  for (const [key, value] of Object.entries(input)) {
    normalized[key.trim().toLowerCase()] = value
  }

  const get = (key: string) =>
    typeof normalized[key] === "number" ? normalized[key] : 0

  return {
    pending: get("pending"),
    processing: get("processing"),
    completed: get("completed") || get("done") || get("success") || get("ready"),
    error: get("error") || get("failed"),
  }
}

export default function AdminDashboardPage() {
  const router = useRouter()

  const apiBaseUrl = useMemo(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
    return baseUrl?.replace(/\/+$/, "") ?? ""
  }, [])

  const [backendDocsUrl, backendOpenApiUrl] = useMemo(() => {
    if (!apiBaseUrl) return ["", ""]
    return [
      new URL("/docs", apiBaseUrl).toString(),
      new URL("/openapi.json", apiBaseUrl).toString(),
    ]
  }, [apiBaseUrl])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [docsStats, setDocsStats] = useState<DocumentsStatsResponse | null>(null)
  const [chatStats, setChatStats] = useState<ChatStatsResponse | null>(null)
  const [sessions, setSessions] = useState<ChatSessionItem[]>([])
  const [sessionsWarning, setSessionsWarning] = useState<string | null>(null)
  const [statsWarning, setStatsWarning] = useState<string | null>(null)
  const [resolvedPaths, setResolvedPaths] = useState<{
    documents: string | null
    chat: string | null
    sessions: string | null
  } | null>(null)

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

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setSessionsWarning(null)
    setStatsWarning(null)
    setResolvedPaths(null)

    if (!apiBaseUrl) {
      setIsLoading(false)
      setError(
        "Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.",
      )
      return
    }

    try {
      const adminDocsCandidates = [
        "/api/v1/admin/stats/documents",
        "/admin/stats/documents",
      ]
      const adminChatCandidates = [
        "/api/v1/admin/stats/chat",
        "/admin/stats/chat",
      ]
      const adminSessionsCandidates = [
        "/api/v1/admin/chat/sessions",
        "/admin/chat/sessions",
      ]

      const loadOpenApiPaths = async (): Promise<Set<string> | null> => {
        const candidates = ["/openapi.json", "/api/v1/openapi.json"]
        for (const path of candidates) {
          try {
            const url = new URL(path, apiBaseUrl)
            const res = await fetch(url.toString(), {
              method: "GET",
              headers: { accept: "application/json" },
            })
            if (!res.ok) continue
            const data = (await res.json().catch(() => null)) as unknown
            const pathsObj = (data as { paths?: unknown })?.paths
            if (!pathsObj || typeof pathsObj !== "object") continue
            return new Set(Object.keys(pathsObj as Record<string, unknown>))
          } catch {
            // Ignore OpenAPI fetch issues; we can still try endpoints directly.
          }
        }
        return null
      }

      const openApiPaths = await loadOpenApiPaths()
      const resolveFromOpenApi = (paths: string[]) => {
        if (!openApiPaths) return null
        for (const path of paths) {
          if (openApiPaths.has(path)) return path
          if (openApiPaths.has(`${path}/`)) return path
        }
        return null
      }

      const fetchFirstOk = async (paths: string[]) => {
        let last: Response | null = null
        for (const path of paths) {
          const url = new URL(path, apiBaseUrl)
          const res = await authFetch(url.toString(), { method: "GET" })
          last = res
          if (res.ok) return res
          if (res.status === 404) continue
          return res
        }
        return last
      }

      const computeDocumentStatsFromList = async (): Promise<DocumentsStatsResponse> => {
        const limit = 100
        let skip = 0
        let total: number | null = null
        const byStatus: Record<string, number> = {}
        const byContentType: Record<string, number> = {}
        let updatedLast24h = 0
        const cutoff = Date.now() - 24 * 60 * 60 * 1000

        for (let page = 0; page < 50; page += 1) {
          const url = new URL("/api/v1/documents", apiBaseUrl)
          url.searchParams.set("skip", String(skip))
          url.searchParams.set("limit", String(limit))

          const res = await authFetch(url.toString(), { method: "GET" })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            const message =
              body?.detail ||
              body?.message ||
              `Failed to load documents (${res.status}).`
            throw new Error(message)
          }

          const data = (await res.json().catch(() => null)) as unknown
          if (!data || typeof data !== "object") break
          const items = (data as { items?: unknown }).items
          const nextTotal = (data as { total?: unknown }).total
          if (typeof nextTotal === "number") total = nextTotal

          if (!Array.isArray(items)) break
          const typed = items as DocumentListItem[]
          for (const doc of typed) {
            const status = typeof doc.status === "string" ? doc.status.trim().toLowerCase() : "unknown"
            byStatus[status] = (byStatus[status] ?? 0) + 1

            const ct = typeof doc.content_type === "string" ? doc.content_type.trim() : ""
            if (ct) byContentType[ct] = (byContentType[ct] ?? 0) + 1

            const updatedAt = typeof doc.updated_at === "string" ? Date.parse(doc.updated_at) : NaN
            if (!Number.isNaN(updatedAt) && updatedAt >= cutoff) updatedLast24h += 1
          }

          skip += typed.length
          if (total != null && skip >= total) break
          if (typed.length < limit) break
        }

        return {
          total: total ?? Object.values(byStatus).reduce((sum, value) => sum + value, 0),
          by_status: byStatus,
          by_content_type: byContentType,
          updated_last_24h: updatedLast24h,
        }
      }

      // Documents stats (admin endpoint with fallback).
      const docsResolved = resolveFromOpenApi(adminDocsCandidates)
      setResolvedPaths((prev) => ({
        documents: docsResolved ?? prev?.documents ?? null,
        chat: prev?.chat ?? null,
        sessions: prev?.sessions ?? null,
      }))

      const docsRes = docsResolved
        ? await authFetch(new URL(docsResolved, apiBaseUrl).toString(), { method: "GET" })
        : await fetchFirstOk(adminDocsCandidates)
      if (docsRes?.ok) {
        const docsData = (await docsRes
          .json()
          .catch(() => null)) as DocumentsStatsResponse | null
        if (!docsData || typeof docsData.total !== "number") {
          throw new Error("Unexpected response from documents stats endpoint.")
        }
        setDocsStats(docsData)
      } else if (docsRes?.status === 404) {
        setStatsWarning(
          docsResolved
            ? "Admin document stats endpoint not present in OpenAPI. Showing document stats from /documents."
            : "Admin stats endpoints unavailable. Showing document stats from /documents.",
        )
        setDocsStats(await computeDocumentStatsFromList())
      } else if (docsRes) {
        const body = await docsRes.json().catch(() => ({}))
        const message =
          body?.detail ||
          body?.message ||
          `Failed to load document stats (${docsRes.status}).`
        throw new Error(message)
      }

      // Chat stats (optional).
      const chatResolved = resolveFromOpenApi(adminChatCandidates)
      setResolvedPaths((prev) => ({
        documents: prev?.documents ?? docsResolved ?? null,
        chat: chatResolved ?? prev?.chat ?? null,
        sessions: prev?.sessions ?? null,
      }))

      const chatRes = chatResolved
        ? await authFetch(new URL(chatResolved, apiBaseUrl).toString(), { method: "GET" })
        : await fetchFirstOk(adminChatCandidates)
      if (chatRes?.ok) {
        const chatData = (await chatRes
          .json()
          .catch(() => null)) as ChatStatsResponse | null
        if (!chatData || typeof chatData.total_sessions !== "number") {
          throw new Error("Unexpected response from chat stats endpoint.")
        }
        setChatStats(chatData)
      } else if (chatRes?.status === 404) {
        setChatStats(null)
        setStatsWarning((prev) =>
          prev ??
          (chatResolved
            ? "Admin chat stats endpoint not present in OpenAPI."
            : "Admin chat stats endpoint not available."),
        )
      } else if (chatRes) {
        const body = await chatRes.json().catch(() => ({}))
        const message =
          body?.detail || body?.message || `Failed to load chat stats (${chatRes.status}).`
        throw new Error(message)
      }

      // Recent sessions (optional).
      const sessionsResolved = resolveFromOpenApi(adminSessionsCandidates)
      setResolvedPaths((prev) => ({
        documents: prev?.documents ?? docsResolved ?? null,
        chat: prev?.chat ?? chatResolved ?? null,
        sessions: sessionsResolved ?? prev?.sessions ?? null,
      }))

      const sessionsUrlRes = sessionsResolved
        ? await (async () => {
            const url = new URL(sessionsResolved, apiBaseUrl)
            url.searchParams.set("limit", "20")
            return authFetch(url.toString(), { method: "GET" })
          })()
        : await (async () => {
            let last: Response | null = null
            for (const path of adminSessionsCandidates) {
              const url = new URL(path, apiBaseUrl)
              url.searchParams.set("limit", "20")
              const res = await authFetch(url.toString(), { method: "GET" })
              last = res
              if (res.ok) return res
              if (res.status === 404) continue
              return res
            }
            return last
          })()

      if (sessionsUrlRes && sessionsUrlRes.ok) {
        const sessionsData = (await sessionsUrlRes.json().catch(() => null)) as unknown
        if (Array.isArray(sessionsData)) {
          setSessions(sessionsData as ChatSessionItem[])
        } else {
          setSessionsWarning("Unexpected response from sessions endpoint.")
          setSessions([])
        }
      } else if (sessionsUrlRes?.status === 404) {
        setSessionsWarning(
          sessionsResolved
            ? "Recent sessions endpoint not present in OpenAPI."
            : "Recent sessions endpoint not found (404).",
        )
        setSessions([])
      } else if (sessionsUrlRes) {
        setSessionsWarning(`Unable to load recent chat sessions (${sessionsUrlRes.status}).`)
        setSessions([])
      } else {
        setSessionsWarning("Recent chat sessions endpoint is unavailable.")
        setSessions([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.")
    } finally {
      setIsLoading(false)
    }
  }, [apiBaseUrl, authFetch])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const statusCounts = useMemo(() => {
    return normalizeStatusCounts(docsStats?.by_status ?? {})
  }, [docsStats])

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Admin view across all users</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={loadDashboard}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            {backendDocsUrl ? (
              <Button variant="outline" asChild className="gap-2">
                <a href={backendDocsUrl} target="_blank" rel="noreferrer">
                  API Docs
                </a>
              </Button>
            ) : null}
            <Button asChild className="gap-2">
              <Link href="/documents">
                <FileText className="h-4 w-4" />
                Documents
              </Link>
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link href="/chat">
                <MessageSquare className="h-4 w-4" />
                Chat
              </Link>
            </Button>
          </div>
        </div>

        {error ? (
          <ErrorDisplay
            title="Failed to load dashboard"
            message={error}
            onRetry={loadDashboard}
          />
        ) : null}

        {statsWarning ? (
          <Alert className="bg-muted/30">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Limited admin metrics</AlertTitle>
            <AlertDescription>
              <p>{statsWarning}</p>
              <p className="text-xs">
                You can still demo Upload → Ingest → Search → Chat normally.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Stats Grid */}
        {isLoading ? (
          <LoadingSkeleton variant="card" count={4} />
        ) : docsStats ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{docsStats.total.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {docsStats.updated_last_24h != null
                    ? `${docsStats.updated_last_24h.toLocaleString()} updated last 24h`
                    : "Across all users"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statusCounts.completed.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Successfully processed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Processing</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statusCounts.processing.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">In progress</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Errors</CardTitle>
                <TriangleAlert className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statusCounts.error.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Need attention</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Charts and Activity */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Chat usage</CardTitle>
              <CardDescription>
                High-level metrics from /admin/stats/chat
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <LoadingSkeleton variant="list" count={4} />
              ) : chatStats ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Total sessions</p>
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold mt-2">
                      {chatStats.total_sessions.toLocaleString()}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Total messages</p>
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold mt-2">
                      {chatStats.total_messages.toLocaleString()}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Active sessions (24h)</p>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold mt-2">
                      {chatStats.active_sessions_last_24h.toLocaleString()}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Messages (24h)</p>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold mt-2">
                      {chatStats.messages_last_24h.toLocaleString()}
                    </p>
                  </Card>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Chat stats not available.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Recent chat sessions</CardTitle>
              <CardDescription>
                Optional: /admin/chat/sessions?limit=20
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessionsWarning ? (
                <div className="mb-3">
                  <Badge variant="outline">{sessionsWarning}</Badge>
                </div>
              ) : null}
              {isLoading ? (
                <LoadingSkeleton variant="list" count={4} />
              ) : sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sessions available yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className="w-full text-left flex items-start gap-3 rounded-md p-2 hover:bg-accent transition-colors"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          localStorage.setItem("chat_session_id", String(session.id))
                          localStorage.setItem("chat_session_key", session.session_key)
                        }
                        toast.success("Opened chat session")
                        router.push("/chat")
                      }}
                    >
                      <div className="rounded-full bg-primary/10 p-2 mt-0.5">
                        <Clock className="h-3 w-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium leading-none truncate">
                          {session.name || `Session #${session.id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Updated {formatDateTime(session.updated_at)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {(resolvedPaths || backendOpenApiUrl) && (statsWarning || sessionsWarning) ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Technical details</CardTitle>
              <CardDescription>Optional debugging info for backend routes.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="diagnostics">
                  <AccordionTrigger>Backend diagnostics</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="truncate">
                        API base: <span className="font-mono">{apiBaseUrl || "—"}</span>
                      </p>
                      {backendOpenApiUrl ? (
                        <p className="truncate">
                          OpenAPI:{" "}
                          <a
                            className="underline"
                            href={backendOpenApiUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {backendOpenApiUrl}
                          </a>
                        </p>
                      ) : null}
                      {resolvedPaths ? (
                        <div className="space-y-1">
                          <p className="truncate">
                            Documents stats:{" "}
                            <span className="font-mono">{resolvedPaths.documents ?? "—"}</span>
                          </p>
                          <p className="truncate">
                            Chat stats:{" "}
                            <span className="font-mono">{resolvedPaths.chat ?? "—"}</span>
                          </p>
                          <p className="truncate">
                            Sessions list:{" "}
                            <span className="font-mono">{resolvedPaths.sessions ?? "—"}</span>
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        ) : null}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/admin/users">
                <Card className="cursor-pointer hover:bg-accent transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base">Manage Users</CardTitle>
                    <CardDescription>
                      View and manage user accounts
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/admin/documents">
                <Card className="cursor-pointer hover:bg-accent transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base">Manage Documents</CardTitle>
                    <CardDescription>
                      Review and moderate documents
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/admin/settings">
                <Card className="cursor-pointer hover:bg-accent transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base">System Settings</CardTitle>
                    <CardDescription>
                      Configure platform settings
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
