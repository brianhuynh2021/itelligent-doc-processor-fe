"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  Gauge,
  Loader2,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react"

import { AdminLayout } from "@/components/admin/AdminLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  BarChart,
  DonutChart,
  Heatmap,
  LineChart,
  type ChartDatum,
} from "@/components/ui/charts"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  apiCandidates,
  downloadTextFile,
  readErrorMessage,
  toCsv,
  useAuthFetch,
} from "@/lib/api"

type DocsStats = {
  total: number
  by_status: Record<string, number>
  by_content_type?: Record<string, number>
  updated_last_24h?: number
}

type ChatStats = {
  total_sessions: number
  total_messages: number
  messages_last_24h: number
  active_sessions_last_24h: number
}

type CacheStats = {
  hits?: number
  misses?: number
  sets?: number
  evictions?: number
  [key: string]: unknown
}

// Rough cost model for an estimated breakdown (no billing endpoint on backend).
const COST = {
  perMessageUsd: 0.004, // avg LLM tokens per Q&A turn
  perDocStorageUsd: 0.002, // embedding + storage per document
  perDocProcessingUsd: 0.01, // OCR + chunking + embedding pipeline
}

function normalizeStatus(input: Record<string, number>) {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(input)) {
    out[k.trim().toLowerCase()] = (out[k.trim().toLowerCase()] ?? 0) + v
  }
  const get = (k: string) => out[k] ?? 0
  return {
    pending: get("pending") + get("queued") + get("uploaded"),
    processing: get("processing") + get("in_progress") + get("running"),
    completed: get("completed") + get("done") + get("success") + get("ready"),
    error: get("error") + get("failed") + get("failure"),
  }
}

export default function AdminAnalyticsPage() {
  const { fetchFirstOk } = useAuthFetch()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocsStats | null>(null)
  const [chat, setChat] = useState<ChatStats | null>(null)
  const [cache, setCache] = useState<CacheStats | null>(null)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setNotice(null)
    const missing: string[] = []
    try {
      const query: Record<string, string> = {}
      if (from) query.created_from = new Date(from).toISOString()
      if (to) query.created_to = new Date(to).toISOString()

      const docsRes = await fetchFirstOk(
        apiCandidates("/admin/stats/documents"),
        { query },
      )
      if (docsRes?.ok) {
        setDocs((await docsRes.json()) as DocsStats)
      } else if (docsRes?.status === 404) {
        missing.push("document stats")
        setDocs(null)
      } else if (docsRes) {
        throw new Error(
          await readErrorMessage(docsRes, `Document stats failed (${docsRes.status}).`),
        )
      }

      const chatRes = await fetchFirstOk(apiCandidates("/admin/stats/chat"), {
        query,
      })
      if (chatRes?.ok) {
        setChat((await chatRes.json()) as ChatStats)
      } else if (chatRes?.status === 404) {
        missing.push("chat stats")
        setChat(null)
      } else if (chatRes) {
        throw new Error(
          await readErrorMessage(chatRes, `Chat stats failed (${chatRes.status}).`),
        )
      }

      const cacheRes = await fetchFirstOk(apiCandidates("/admin/cache/stats"))
      if (cacheRes?.ok) {
        setCache((await cacheRes.json()) as CacheStats)
      } else {
        missing.push("cache stats")
        setCache(null)
      }

      if (missing.length) {
        setNotice(`Unavailable from backend: ${missing.join(", ")}.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.")
    } finally {
      setIsLoading(false)
    }
  }, [fetchFirstOk, from, to])

  useEffect(() => {
    void load()
  }, [load])

  const status = useMemo(
    () => normalizeStatus(docs?.by_status ?? {}),
    [docs],
  )

  const cacheHitRate = useMemo(() => {
    const hits = Number(cache?.hits ?? 0)
    const misses = Number(cache?.misses ?? 0)
    const total = hits + misses
    return total > 0 ? hits / total : null
  }, [cache])

  const successRate = useMemo(() => {
    const finished = status.completed + status.error
    return finished > 0 ? status.completed / finished : null
  }, [status])

  const kpis = [
    {
      title: "Total Documents",
      value: docs ? docs.total.toLocaleString() : "—",
      description: docs?.updated_last_24h
        ? `${docs.updated_last_24h.toLocaleString()} updated last 24h`
        : "Across all users",
      icon: BarChart3,
    },
    {
      title: "Active Sessions (24h)",
      value: chat ? chat.active_sessions_last_24h.toLocaleString() : "—",
      description: chat
        ? `${chat.total_sessions.toLocaleString()} sessions total`
        : "Chat stats unavailable",
      icon: Users,
    },
    {
      title: "Messages (24h)",
      value: chat ? chat.messages_last_24h.toLocaleString() : "—",
      description: chat
        ? `${chat.total_messages.toLocaleString()} messages total`
        : "Chat stats unavailable",
      icon: MessageSquare,
    },
    {
      title: "Cache Hit Rate",
      value:
        cacheHitRate != null ? `${(cacheHitRate * 100).toFixed(1)}%` : "—",
      description: cache
        ? `${Number(cache.hits ?? 0).toLocaleString()} hits / ${Number(
            cache.misses ?? 0,
          ).toLocaleString()} misses`
        : "Cache stats unavailable",
      icon: Gauge,
    },
  ]

  const statusData: ChartDatum[] = [
    { label: "Completed", value: status.completed, colorIndex: 1 },
    { label: "Processing", value: status.processing, colorIndex: 4 },
    { label: "Pending", value: status.pending, colorIndex: 2 },
    { label: "Error", value: status.error, colorIndex: 0 },
  ]

  const contentTypeData: ChartDatum[] = useMemo(() => {
    const entries = Object.entries(docs?.by_content_type ?? {})
      .map(([label, value]) => ({
        label: label.split("/").pop() ?? label,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
    return entries
  }, [docs])

  const chatUsageData: ChartDatum[] = chat
    ? [
        { label: "Sessions", value: chat.total_sessions, colorIndex: 2 },
        { label: "Messages", value: chat.total_messages, colorIndex: 1 },
        { label: "Msg 24h", value: chat.messages_last_24h, colorIndex: 4 },
        {
          label: "Active 24h",
          value: chat.active_sessions_last_24h,
          colorIndex: 3,
        },
      ]
    : []

  // Estimated activity distribution (no time-series endpoint): spread the
  // 24h message volume across a deterministic day/hour weight pattern.
  const heatmap = useMemo(() => {
    const total = chat?.messages_last_24h ?? 0
    const dayWeights = [0.8, 1, 1.1, 1.05, 1.15, 0.6, 0.4] // Mon..Sun
    const hourBuckets = 8 // 3-hour windows
    const hourWeights = [0.2, 0.4, 1, 1.2, 1.1, 0.9, 0.6, 0.3]
    const cells: { row: number; col: number; value: number }[] = []
    const wSum =
      dayWeights.reduce((a, b) => a + b, 0) *
      hourWeights.reduce((a, b) => a + b, 0)
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < hourBuckets; c++) {
        const value = Math.round(
          (total * (dayWeights[r] ?? 0) * (hourWeights[c] ?? 0)) / wSum,
        )
        cells.push({ row: r, col: c, value })
      }
    }
    return cells
  }, [chat])

  const cost = useMemo(() => {
    const messages = chat?.total_messages ?? 0
    const totalDocs = docs?.total ?? 0
    const llm = messages * COST.perMessageUsd
    const storage = totalDocs * COST.perDocStorageUsd
    const processing = totalDocs * COST.perDocProcessingUsd
    return {
      llm,
      storage,
      processing,
      total: llm + storage + processing,
    }
  }, [chat, docs])

  const costData: ChartDatum[] = [
    { label: "LLM / chat", value: Math.round(cost.llm * 100) / 100, colorIndex: 0 },
    {
      label: "Processing",
      value: Math.round(cost.processing * 100) / 100,
      colorIndex: 3,
    },
    {
      label: "Storage",
      value: Math.round(cost.storage * 100) / 100,
      colorIndex: 1,
    },
  ]

  const alerts = useMemo(() => {
    const out: { id: string; title: string; detail: string; severity: string }[] =
      []
    if (status.error > 0) {
      out.push({
        id: "errors",
        title: `${status.error} document(s) failed processing`,
        detail: "Check the documents queue and re-run ingestion for failed items.",
        severity: status.error > 5 ? "high" : "medium",
      })
    }
    if (status.processing > 10) {
      out.push({
        id: "backlog",
        title: "Processing backlog building up",
        detail: `${status.processing} documents are still processing.`,
        severity: "medium",
      })
    }
    if (cacheHitRate != null && cacheHitRate < 0.5) {
      out.push({
        id: "cache",
        title: "Low cache hit rate",
        detail: `Cache is serving only ${(cacheHitRate * 100).toFixed(
          0,
        )}% of search requests from cache.`,
        severity: "low",
      })
    }
    if (out.length === 0) {
      out.push({
        id: "ok",
        title: "All systems nominal",
        detail: "No anomalies detected in the current metrics window.",
        severity: "low",
      })
    }
    return out
  }, [status, cacheHitRate])

  const exportReport = useCallback(() => {
    const rows = [
      { metric: "Total documents", value: docs?.total ?? "" },
      { metric: "Completed", value: status.completed },
      { metric: "Processing", value: status.processing },
      { metric: "Pending", value: status.pending },
      { metric: "Error", value: status.error },
      { metric: "Success rate", value: successRate != null ? `${(successRate * 100).toFixed(1)}%` : "" },
      { metric: "Total sessions", value: chat?.total_sessions ?? "" },
      { metric: "Total messages", value: chat?.total_messages ?? "" },
      { metric: "Messages 24h", value: chat?.messages_last_24h ?? "" },
      { metric: "Active sessions 24h", value: chat?.active_sessions_last_24h ?? "" },
      { metric: "Cache hit rate", value: cacheHitRate != null ? `${(cacheHitRate * 100).toFixed(1)}%` : "" },
      { metric: "Estimated cost (USD)", value: cost.total.toFixed(2) },
    ]
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(
      `analytics-report-${stamp}.csv`,
      toCsv(rows, ["metric", "value"]),
    )
  }, [docs, status, successRate, chat, cacheHitRate, cost])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">
              Track platform performance, usage, and operational health
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs">
                From
              </Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs">
                To
              </Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 w-[150px]"
              />
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={load}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Apply
            </Button>
            <Button className="gap-2" onClick={exportReport}>
              <ArrowUpRight className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Failed to load analytics</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {notice ? (
          <Alert className="bg-muted/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Partial metrics</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        {/* KPI cards */}
        {isLoading ? (
          <LoadingSkeleton variant="card" count={4} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpis.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {item.title}
                    </CardTitle>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{item.value}</div>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <Tabs defaultValue="usage" className="space-y-4">
          <TabsList>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="reliability">Reliability</TabsTrigger>
            <TabsTrigger value="cost">Cost</TabsTrigger>
          </TabsList>

          <TabsContent value="usage" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Document status</CardTitle>
                  <CardDescription>Distribution across the pipeline</CardDescription>
                </CardHeader>
                <CardContent>
                  {docs ? (
                    <DonutChart
                      data={statusData}
                      centervalue={docs.total.toLocaleString()}
                      centerLabel="documents"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Document stats unavailable.
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Chat usage</CardTitle>
                  <CardDescription>Sessions and messages</CardDescription>
                </CardHeader>
                <CardContent>
                  {chat ? (
                    <BarChart data={chatUsageData} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Chat stats unavailable.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Documents by content type</CardTitle>
                <CardDescription>Top file types ingested</CardDescription>
              </CardHeader>
              <CardContent>
                {contentTypeData.length ? (
                  <BarChart data={contentTypeData} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No content-type breakdown available.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Activity pattern</CardTitle>
                <CardDescription>
                  Estimated message distribution by day/time (derived from 24h
                  volume)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Heatmap
                  cells={heatmap}
                  rows={7}
                  cols={8}
                  rowLabels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
                  colLabels={[
                    "0",
                    "3",
                    "6",
                    "9",
                    "12",
                    "15",
                    "18",
                    "21",
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Cache effectiveness</CardTitle>
                  <CardDescription>Search cache hit vs miss</CardDescription>
                </CardHeader>
                <CardContent>
                  {cache ? (
                    <DonutChart
                      data={[
                        {
                          label: "Hits",
                          value: Number(cache.hits ?? 0),
                          colorIndex: 1,
                        },
                        {
                          label: "Misses",
                          value: Number(cache.misses ?? 0),
                          colorIndex: 0,
                        },
                      ]}
                      centervalue={
                        cacheHitRate != null
                          ? `${(cacheHitRate * 100).toFixed(0)}%`
                          : "—"
                      }
                      centerLabel="hit rate"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Cache stats unavailable.
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Pipeline throughput</CardTitle>
                  <CardDescription>Documents by processing stage</CardDescription>
                </CardHeader>
                <CardContent>
                  {docs ? (
                    <BarChart
                      data={[
                        { label: "Completed", value: status.completed, colorIndex: 1 },
                        { label: "Processing", value: status.processing, colorIndex: 4 },
                        { label: "Pending", value: status.pending, colorIndex: 2 },
                      ]}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Document stats unavailable.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reliability" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Processing success rate</CardTitle>
                  <CardDescription>Completed vs failed documents</CardDescription>
                </CardHeader>
                <CardContent>
                  {docs ? (
                    <DonutChart
                      data={[
                        { label: "Completed", value: status.completed, colorIndex: 1 },
                        { label: "Error", value: status.error, colorIndex: 0 },
                      ]}
                      centervalue={
                        successRate != null
                          ? `${(successRate * 100).toFixed(1)}%`
                          : "—"
                      }
                      centerLabel="success"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Document stats unavailable.
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Error trend</CardTitle>
                  <CardDescription>
                    Current error / processing / completed counts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LineChart
                    data={[
                      { label: "Error", value: status.error },
                      { label: "Processing", value: status.processing },
                      { label: "Pending", value: status.pending },
                      { label: "Completed", value: status.completed },
                    ]}
                    colorIndex={0}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cost" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Estimated cost breakdown
                  </CardTitle>
                  <CardDescription>
                    Modeled from usage — not actual billing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DonutChart
                    data={costData}
                    centervalue={`$${cost.total.toFixed(2)}`}
                    centerLabel="estimated total"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Savings suggestions</CardTitle>
                  <CardDescription>Ways to reduce spend</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <p>
                      Increase search cache TTL — current hit rate{" "}
                      {cacheHitRate != null
                        ? `${(cacheHitRate * 100).toFixed(0)}%`
                        : "n/a"}
                      . Higher hits cut repeat LLM calls.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <p>
                      Re-process the {status.error} failed document(s) in batch to
                      avoid repeated partial ingestion costs.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <p>
                      Route short factual queries to a smaller model — LLM/chat is
                      the largest cost component (${cost.llm.toFixed(2)}).
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Operational Alerts
            </CardTitle>
            <CardDescription>
              Derived from the current metrics window
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-md border p-4"
                >
                  <AlertTriangle
                    className={
                      alert.severity === "high"
                        ? "mt-1 h-4 w-4 text-destructive"
                        : alert.severity === "medium"
                          ? "mt-1 h-4 w-4 text-amber-500"
                          : "mt-1 h-4 w-4 text-muted-foreground"
                    }
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-medium">{alert.title}</h3>
                      <Badge variant="outline" className="uppercase tracking-wide">
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
