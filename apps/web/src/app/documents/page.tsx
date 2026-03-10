"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useHeaderSlots } from "@/components/layout/HeaderSlotsProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Database,
  FileText,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
  UploadCloud,
} from "lucide-react"

type IngestStatus = "pending" | "processing" | "processed" | "failed"
type IndexStatus = "not_indexed" | "indexing" | "indexed" | "error"

type RAGCollectionId = "default" | "product" | "policies"

type RAGDocumentRow = {
  id: string
  name: string
  type: "PDF" | "DOCX" | "TXT" | "XLSX" | "CSV"
  sizeMb: number
  updatedAt: string
  owner: string
  collectionId: RAGCollectionId
  ingest: { status: IngestStatus; progress?: number }
  index: { status: IndexStatus; chunks?: number; embeddings?: number; lastIndexedAt?: string }
  tags: string[]
}

const COLLECTIONS: { id: RAGCollectionId; label: string }[] = [
  { id: "default", label: "Default KB" },
  { id: "product", label: "Product Docs" },
  { id: "policies", label: "Company Policies" },
]

const MOCK_DOCS: RAGDocumentRow[] = [
  {
    id: "DOC-001",
    name: "Technical Documentation.pdf",
    type: "PDF",
    sizeMb: 12.4,
    updatedAt: "2 hours ago",
    owner: "Sarah Chen",
    collectionId: "product",
    ingest: { status: "processed" },
    index: { status: "indexed", chunks: 186, embeddings: 186, lastIndexedAt: "1 hour ago" },
    tags: ["API", "Release"],
  },
  {
    id: "DOC-002",
    name: "HR Policies 2026.docx",
    type: "DOCX",
    sizeMb: 3.1,
    updatedAt: "6 hours ago",
    owner: "Priya Patel",
    collectionId: "policies",
    ingest: { status: "processing", progress: 62 },
    index: { status: "indexing", chunks: 0, embeddings: 0, lastIndexedAt: "—" },
    tags: ["HR", "Policies"],
  },
  {
    id: "DOC-003",
    name: "Customer Feedback.csv",
    type: "CSV",
    sizeMb: 1.8,
    updatedAt: "1 day ago",
    owner: "Alex Martinez",
    collectionId: "default",
    ingest: { status: "processed" },
    index: { status: "not_indexed", chunks: 0, embeddings: 0, lastIndexedAt: "—" },
    tags: ["Support"],
  },
  {
    id: "DOC-004",
    name: "Financial Report 2025.xlsx",
    type: "XLSX",
    sizeMb: 8.7,
    updatedAt: "2 days ago",
    owner: "James Wilson",
    collectionId: "default",
    ingest: { status: "failed" },
    index: { status: "error", chunks: 0, embeddings: 0, lastIndexedAt: "—" },
    tags: ["Finance"],
  },
]

function badgeForIngest(status: IngestStatus) {
  if (status === "processed") return <Badge>Ingested</Badge>
  if (status === "processing") return <Badge variant="secondary">Ingesting</Badge>
  if (status === "failed") return <Badge variant="destructive">Ingest failed</Badge>
  return <Badge variant="outline">Pending</Badge>
}

function badgeForIndex(status: IndexStatus) {
  if (status === "indexed") return <Badge>Indexed</Badge>
  if (status === "indexing") return <Badge variant="secondary">Indexing</Badge>
  if (status === "error") return <Badge variant="destructive">Index error</Badge>
  return <Badge variant="outline">Not indexed</Badge>
}

export default function DocumentsPage() {
  const { setSlot, clearSlot } = useHeaderSlots()
  const [query, setQuery] = useState("")
  const [docs, setDocs] = useState<RAGDocumentRow[]>(MOCK_DOCS)

  useEffect(() => {
    setSlot(
      "center",
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="h-9 w-64 pl-9"
          />
        </div>
        <Button variant="outline" asChild className="h-9 hidden lg:inline-flex">
          <Link href="/chat">
            <Sparkles className="h-4 w-4 mr-2" />
            Ask with RAG
          </Link>
        </Button>
      </div>
    )
    return () => clearSlot("center")
  }, [clearSlot, query, setSlot])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return docs
    return docs.filter((d) => {
      const hay = [
        d.name,
        d.id,
        d.owner,
        d.type,
        d.collectionId,
        ...d.tags,
      ]
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [docs, query])

  const stats = useMemo(() => {
    const total = docs.length
    const indexed = docs.filter((d) => d.index.status === "indexed").length
    const ingestFailed = docs.filter((d) => d.ingest.status === "failed").length
    const totalChunks = docs.reduce((sum, d) => sum + (d.index.chunks || 0), 0)
    return { total, indexed, ingestFailed, totalChunks }
  }, [docs])

  const updateCollection = (id: string, collectionId: RAGCollectionId) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, collectionId } : d))
    )
  }

  return (
    <div className="min-h-[calc(100vh-var(--app-header-height))]">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Documents</h1>
            <p className="text-muted-foreground">
              Ingest, chunk, and index your files for Retrieval-Augmented Generation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Sync
            </Button>
            <Button variant="outline" className="gap-2">
              <UploadCloud className="h-4 w-4" />
              Upload
            </Button>
            <Button className="gap-2" asChild>
              <Link href="/chat">
                <Sparkles className="h-4 w-4" />
                Open RAG Chat
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium">Documents</CardTitle>
                <CardDescription>Total uploaded files</CardDescription>
              </div>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium">Indexed</CardTitle>
                <CardDescription>Ready for retrieval</CardDescription>
              </div>
              <Database className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.indexed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium">Chunks</CardTitle>
                <CardDescription>Vectorized segments</CardDescription>
              </div>
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalChunks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium">Errors</CardTitle>
                <CardDescription>Ingest/index failures</CardDescription>
              </div>
              <TriangleAlert className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.ingestFailed}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>RAG-ready library</CardTitle>
            <CardDescription>
              Track ingest and indexing status, and assign documents to a knowledge base.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:hidden">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search documents…"
                  className="h-9 pl-9"
                />
              </div>
              <Separator />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Knowledge base</TableHead>
                    <TableHead>Ingest</TableHead>
                    <TableHead>Index</TableHead>
                    <TableHead className="hidden lg:table-cell">Chunks</TableHead>
                    <TableHead className="hidden lg:table-cell">Embeddings</TableHead>
                    <TableHead className="hidden xl:table-cell">Last indexed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{doc.name}</div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                            <span>{doc.id}</span>
                            <span>•</span>
                            <span>{doc.type}</span>
                            <span>•</span>
                            <span>{doc.sizeMb.toFixed(1)} MB</span>
                            <span>•</span>
                            <span>Updated {doc.updatedAt}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {doc.tags.map((t) => (
                              <Badge key={t} variant="outline">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-9 justify-between w-44">
                              {COLLECTIONS.find((c) => c.id === doc.collectionId)?.label ??
                                doc.collectionId}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuLabel>Assign knowledge base</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup
                              value={doc.collectionId}
                              onValueChange={(v) => updateCollection(doc.id, v as RAGCollectionId)}
                            >
                              {COLLECTIONS.map((c) => (
                                <DropdownMenuRadioItem key={c.id} value={c.id}>
                                  {c.label}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-2">
                          <div>{badgeForIngest(doc.ingest.status)}</div>
                          {doc.ingest.status === "processing" && (
                            <Progress value={doc.ingest.progress ?? 0} />
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-2">
                          <div>{badgeForIndex(doc.index.status)}</div>
                          <div className="text-xs text-muted-foreground">
                            Owner: {doc.owner}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="hidden lg:table-cell">
                        <span className="font-medium">{doc.index.chunks ?? 0}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="font-medium">{doc.index.embeddings ?? 0}</span>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {doc.index.lastIndexedAt ?? "—"}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Reindex
                          </Button>
                          <Button size="sm" className="gap-2" asChild>
                            <Link href="/chat">
                              <Sparkles className="h-4 w-4" />
                              Ask
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <div className="text-sm text-muted-foreground">
                          No documents match your search.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

