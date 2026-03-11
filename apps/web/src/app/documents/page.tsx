'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useHeaderSlots } from '@/components/layout/HeaderSlotsProvider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Database,
  FileText,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
  UploadCloud,
} from 'lucide-react'
import { clearAuthTokens, getAccessToken, refreshAccessToken } from '@/lib/auth'

type IngestStatus = 'pending' | 'processing' | 'processed' | 'failed'
type IndexStatus = 'not_indexed' | 'indexing' | 'indexed' | 'error'

type RAGCollectionId = 'default' | 'product' | 'policies'
type CollectionFilter = 'all' | RAGCollectionId
type IngestFilter = 'all' | IngestStatus
type IndexFilter = 'all' | IndexStatus
type SortKey = 'updated' | 'name' | 'chunks'

type BackendDocument = {
  id: number
  name: string
  original_filename: string
  file_path: string
  file_size: number
  content_type: string
  owner_id: number
  status: string
  processing_progress: number
  updated_at: string
}

type DocumentListResponse = {
  items: BackendDocument[]
  total: number
}

type UploadedFileResponse = {
  file_id: string
  filename: string
  content_type: string
  size: number
  document_id?: number
}

type RAGDocumentRow = {
  id: string
  documentId: number
  name: string
  type: 'PDF' | 'DOCX' | 'TXT' | 'XLSX' | 'CSV'
  sizeMb: number
  updatedAt: string
  updatedAtTs: number
  owner: string
  collectionId: RAGCollectionId
  ingest: { status: IngestStatus; progress?: number }
  index: {
    status: IndexStatus
    chunks?: number
    embeddings?: number
    lastIndexedAt?: string
  }
  tags: string[]
}

const COLLECTIONS: { id: RAGCollectionId; label: string }[] = [
  { id: 'default', label: 'Default KB' },
  { id: 'product', label: 'Product Docs' },
  { id: 'policies', label: 'Company Policies' },
]

function badgeForIngest(status: IngestStatus) {
  if (status === 'processed') return <Badge>Ingested</Badge>
  if (status === 'processing')
    return <Badge variant="secondary">Ingesting</Badge>
  if (status === 'failed')
    return <Badge variant="destructive">Ingest failed</Badge>
  return <Badge variant="outline">Pending</Badge>
}

function badgeForIndex(status: IndexStatus) {
  if (status === 'indexed') return <Badge>Indexed</Badge>
  if (status === 'indexing') return <Badge variant="secondary">Indexing</Badge>
  if (status === 'error')
    return <Badge variant="destructive">Index error</Badge>
  return <Badge variant="outline">Not indexed</Badge>
}

function toIngestStatus(status: string): IngestStatus {
  const s = status.trim().toLowerCase()
  if (['completed', 'done', 'success'].includes(s)) return 'processed'
  if (
    [
      'processing',
      'in_progress',
      'running',
      'ocr',
      'chunking',
      'ingesting',
      'embedding',
    ].includes(s)
  ) {
    return 'processing'
  }
  if (['failed', 'error', 'failure'].includes(s)) return 'failed'
  return 'pending'
}

function toIndexStatus(status: string): IndexStatus {
  const s = status.trim().toLowerCase()
  if (['completed', 'done', 'success'].includes(s)) return 'indexed'
  if (
    [
      'processing',
      'in_progress',
      'running',
      'ocr',
      'chunking',
      'ingesting',
      'embedding',
    ].includes(s)
  ) {
    return 'indexing'
  }
  if (['failed', 'error', 'failure'].includes(s)) return 'error'
  return 'not_indexed'
}

function inferFileType(contentType: string): RAGDocumentRow['type'] {
  const normalized = contentType.toLowerCase()
  if (normalized.includes('pdf')) return 'PDF'
  if (normalized.includes('word') || normalized.includes('docx')) return 'DOCX'
  if (normalized.includes('csv')) return 'CSV'
  if (
    normalized.includes('sheet') ||
    normalized.includes('excel') ||
    normalized.includes('xlsx')
  ) {
    return 'XLSX'
  }
  return 'TXT'
}

function toRelativeTime(isoDate: string): { label: string; ts: number } {
  const ts = Date.parse(isoDate)
  if (Number.isNaN(ts)) return { label: 'Unknown', ts: 0 }

  const now = Date.now()
  const seconds = Math.max(0, Math.floor((now - ts) / 1000))
  if (seconds < 60) return { label: 'just now', ts }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)
    return { label: `${minutes} minute${minutes === 1 ? '' : 's'} ago`, ts }

  const hours = Math.floor(minutes / 60)
  if (hours < 24)
    return { label: `${hours} hour${hours === 1 ? '' : 's'} ago`, ts }

  const days = Math.floor(hours / 24)
  if (days < 30) return { label: `${days} day${days === 1 ? '' : 's'} ago`, ts }

  return {
    label: new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(ts)),
    ts,
  }
}

function mapDocumentToRow(
  doc: BackendDocument,
  collectionByDocId: Record<number, RAGCollectionId>,
): RAGDocumentRow {
  const ingestStatus = toIngestStatus(doc.status)
  const indexStatus = toIndexStatus(doc.status)
  const updated = toRelativeTime(doc.updated_at)

  const row: RAGDocumentRow = {
    id: String(doc.id),
    documentId: doc.id,
    name: doc.name || doc.original_filename,
    type: inferFileType(doc.content_type),
    sizeMb: doc.file_size / (1024 * 1024),
    updatedAt: updated.label,
    updatedAtTs: updated.ts,
    owner: 'You',
    collectionId: collectionByDocId[doc.id] ?? 'default',
    ingest: { status: ingestStatus },
    index: { status: indexStatus },
    tags: [doc.content_type, doc.status].filter(Boolean),
  }

  if (ingestStatus === 'processing') {
    row.ingest.progress = Math.max(
      0,
      Math.min(100, doc.processing_progress || 0),
    )
  }

  if (indexStatus === 'indexed') {
    row.index.lastIndexedAt = updated.label
  }

  return row
}

export default function DocumentsPage() {
  const router = useRouter()
  const { setSlot, clearSlot } = useHeaderSlots()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const apiBaseUrl = useMemo(() => {
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
    return base?.replace(/\/+$/, '') ?? ''
  }, [])

  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<RAGDocumentRow[]>([])
  const [collectionByDocId, setCollectionByDocId] = useState<
    Record<number, RAGCollectionId>
  >({})

  const [collectionFilter, setCollectionFilter] =
    useState<CollectionFilter>('all')
  const [ingestFilter, setIngestFilter] = useState<IngestFilter>('all')
  const [indexFilter, setIndexFilter] = useState<IndexFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('updated')

  const [isLoadingDocs, setIsLoadingDocs] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setSlot(
      'center',
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="h-9 w-64 pl-9"
          />
        </div>
        <Button variant="outline" asChild className="hidden h-9 lg:inline-flex">
          <Link href="/chat">
            <Sparkles className="mr-2 h-4 w-4" />
            Ask with RAG
          </Link>
        </Button>
      </div>,
    )
    return () => clearSlot('center')
  }, [clearSlot, query, setSlot])

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

      const res = await doFetch(token)
      if (res.status !== 401 && res.status !== 403) return res

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

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocs(true)
    setLoadError(null)

    if (!apiBaseUrl) {
      setLoadError(
        'Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.',
      )
      setIsLoadingDocs(false)
      return
    }

    try {
      const url = new URL('/api/v1/documents', apiBaseUrl)
      url.searchParams.set('skip', '0')
      url.searchParams.set('limit', '100')

      const res = await authFetch(url.toString(), { method: 'GET' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message =
          body?.detail ||
          body?.message ||
          `Failed to load documents (${res.status}).`
        throw new Error(message)
      }

      const data = (await res
        .json()
        .catch(() => null)) as DocumentListResponse | null
      if (!data || !Array.isArray(data.items)) {
        throw new Error('Unexpected response from /documents endpoint.')
      }

      setDocs(
        data.items.map((item) => mapDocumentToRow(item, collectionByDocId)),
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load documents.'
      setLoadError(message)
      toast.error(message)
    } finally {
      setIsLoadingDocs(false)
    }
  }, [apiBaseUrl, authFetch, collectionByDocId])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const uploadFile = async (file: File) => {
    if (!apiBaseUrl) {
      toast.error(
        'Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.',
      )
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const url = new URL('/api/v1/files/upload', apiBaseUrl)
      const res = await authFetch(url.toString(), {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message =
          body?.detail || body?.message || `Upload failed (${res.status}).`
        throw new Error(message)
      }

      const data = (await res
        .json()
        .catch(() => null)) as UploadedFileResponse | null
      const uploadedName = data?.filename || file.name
      const docLabel =
        typeof data?.document_id === 'number'
          ? `Document #${data.document_id}`
          : 'document'

      toast.success('Upload successful', {
        description: `${uploadedName} created ${docLabel}.`,
      })

      await loadDocuments()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Upload failed. Please try again.'
      toast.error(message)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      // Upload sequentially to keep UX/state simple.
      await uploadFile(file)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byFilter = docs
      .filter((d) =>
        collectionFilter === 'all' ? true : d.collectionId === collectionFilter,
      )
      .filter((d) =>
        ingestFilter === 'all' ? true : d.ingest.status === ingestFilter,
      )
      .filter((d) =>
        indexFilter === 'all' ? true : d.index.status === indexFilter,
      )
      .filter((d) => {
        if (!q) return true
        const hay = [
          d.name,
          `#${d.documentId}`,
          d.owner,
          d.type,
          d.collectionId,
          ...d.tags,
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })

    const sorted = [...byFilter].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      if (sortKey === 'chunks')
        return (b.index.chunks || 0) - (a.index.chunks || 0)
      return b.updatedAtTs - a.updatedAtTs
    })

    return sorted
  }, [collectionFilter, docs, ingestFilter, indexFilter, query, sortKey])

  const stats = useMemo(() => {
    const total = docs.length
    const indexed = docs.filter((d) => d.index.status === 'indexed').length
    const ingestFailed = docs.filter((d) => d.ingest.status === 'failed').length
    const totalChunks = docs.reduce((sum, d) => sum + (d.index.chunks || 0), 0)
    return { total, indexed, ingestFailed, totalChunks }
  }, [docs])

  const updateCollection = (
    documentId: number,
    collectionId: RAGCollectionId,
  ) => {
    setCollectionByDocId((prev) => ({ ...prev, [documentId]: collectionId }))
    setDocs((prev) =>
      prev.map((d) =>
        d.documentId === documentId ? { ...d, collectionId } : d,
      ),
    )
  }

  const clearFilters = () => {
    setQuery('')
    setCollectionFilter('all')
    setIngestFilter('all')
    setIndexFilter('all')
    setSortKey('updated')
  }

  return (
    <div className="min-h-[calc(100vh-var(--app-header-height))]">
      <div className="container mx-auto space-y-8 px-4 py-8">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,.csv,.xlsx,.png,.jpg,.jpeg"
          onChange={(e) => {
            void handleFileInputChange(e)
          }}
          multiple
        />

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Documents</h1>
            <p className="text-muted-foreground">
              Ingest, chunk, and index your files for Retrieval-Augmented
              Generation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={isLoadingDocs || isUploading}
              onClick={() => {
                void loadDocuments()
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Sync
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={isUploading}
              onClick={openFilePicker}
            >
              <UploadCloud className="h-4 w-4" />
              {isUploading ? 'Uploading...' : 'Upload'}
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
              <FileText className="text-muted-foreground h-5 w-5" />
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
              <Database className="text-muted-foreground h-5 w-5" />
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
              <Sparkles className="text-muted-foreground h-5 w-5" />
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
              <TriangleAlert className="text-muted-foreground h-5 w-5" />
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
              Track ingest and indexing status, and assign documents to a
              knowledge base.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadError ? (
              <div className="border-destructive/20 bg-destructive/5 mb-4 rounded-md border p-3 text-sm">
                <p className="text-destructive font-medium">Error</p>
                <p className="text-destructive/90 break-words">{loadError}</p>
              </div>
            ) : null}

            {isLoadingDocs ? (
              <div className="text-muted-foreground py-16 text-center text-sm">
                Loading documents...
              </div>
            ) : docs.length === 0 ? (
              <div className="py-16 text-center">
                <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
                  <UploadCloud className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">No documents yet</h3>
                <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
                  Upload files to create documents, then ingest/index them for
                  RAG chat.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                  <Button
                    onClick={openFilePicker}
                    className="gap-2"
                    disabled={isUploading}
                  >
                    <UploadCloud className="h-4 w-4" />
                    {isUploading
                      ? 'Uploading...'
                      : 'Upload your first document'}
                  </Button>
                  <Button variant="outline" asChild className="gap-2">
                    <Link href="/chat">
                      <Sparkles className="h-4 w-4" />
                      Open RAG Chat
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 md:hidden">
                  <div className="relative">
                    <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search documents…"
                      className="h-9 pl-9"
                    />
                  </div>
                  <Separator />
                </div>

                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9">
                          Collection:{' '}
                          {collectionFilter === 'all'
                            ? 'All'
                            : (COLLECTIONS.find(
                                (c) => c.id === collectionFilter,
                              )?.label ?? collectionFilter)}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel>Collection</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={collectionFilter}
                          onValueChange={(v) =>
                            setCollectionFilter(v as CollectionFilter)
                          }
                        >
                          <DropdownMenuRadioItem value="all">
                            All
                          </DropdownMenuRadioItem>
                          {COLLECTIONS.map((c) => (
                            <DropdownMenuRadioItem key={c.id} value={c.id}>
                              {c.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9">
                          Ingest:{' '}
                          {ingestFilter === 'all' ? 'All' : ingestFilter}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel>Ingest status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={ingestFilter}
                          onValueChange={(v) =>
                            setIngestFilter(v as IngestFilter)
                          }
                        >
                          <DropdownMenuRadioItem value="all">
                            All
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="pending">
                            pending
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="processing">
                            processing
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="processed">
                            processed
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="failed">
                            failed
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9">
                          Index: {indexFilter === 'all' ? 'All' : indexFilter}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel>Index status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={indexFilter}
                          onValueChange={(v) =>
                            setIndexFilter(v as IndexFilter)
                          }
                        >
                          <DropdownMenuRadioItem value="all">
                            All
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="not_indexed">
                            not_indexed
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="indexing">
                            indexing
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="indexed">
                            indexed
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="error">
                            error
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9">
                          Sort: {sortKey}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Sort</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={sortKey}
                          onValueChange={(v) => setSortKey(v as SortKey)}
                        >
                          <DropdownMenuRadioItem value="updated">
                            updated
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="name">
                            name
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="chunks">
                            chunks
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="ghost"
                      className="h-9"
                      onClick={clearFilters}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Knowledge base</TableHead>
                        <TableHead>Ingest</TableHead>
                        <TableHead>Index</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          Chunks
                        </TableHead>
                        <TableHead className="hidden lg:table-cell">
                          Embeddings
                        </TableHead>
                        <TableHead className="hidden xl:table-cell">
                          Last indexed
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{doc.name}</div>
                              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                                <span>#{doc.documentId}</span>
                                <span>•</span>
                                <span>{doc.type}</span>
                                <span>•</span>
                                <span>{doc.sizeMb.toFixed(1)} MB</span>
                                <span>•</span>
                                <span>Updated {doc.updatedAt}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {doc.tags.map((t) => (
                                  <Badge
                                    key={`${doc.id}-${t}`}
                                    variant="outline"
                                  >
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="h-9 w-44 justify-between"
                                >
                                  {COLLECTIONS.find(
                                    (c) => c.id === doc.collectionId,
                                  )?.label ?? doc.collectionId}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="start"
                                className="w-56"
                              >
                                <DropdownMenuLabel>
                                  Assign knowledge base
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuRadioGroup
                                  value={doc.collectionId}
                                  onValueChange={(v) =>
                                    updateCollection(
                                      doc.documentId,
                                      v as RAGCollectionId,
                                    )
                                  }
                                >
                                  {COLLECTIONS.map((c) => (
                                    <DropdownMenuRadioItem
                                      key={c.id}
                                      value={c.id}
                                    >
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
                              {doc.ingest.status === 'processing' ? (
                                <Progress value={doc.ingest.progress ?? 0} />
                              ) : null}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-2">
                              <div>{badgeForIndex(doc.index.status)}</div>
                              <div className="text-muted-foreground text-xs">
                                Owner: {doc.owner}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="hidden lg:table-cell">
                            <span className="font-medium">
                              {doc.index.chunks ?? 0}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="font-medium">
                              {doc.index.embeddings ?? 0}
                            </span>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <span className="text-muted-foreground text-sm">
                              {doc.index.lastIndexedAt ?? '—'}
                            </span>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() =>
                                  toast.info('Reindex is next step.', {
                                    description: `Add /documents/${doc.documentId}/ingest integration next.`,
                                  })
                                }
                              >
                                <RefreshCw className="h-4 w-4" />
                                Reindex
                              </Button>
                              <Button size="sm" className="gap-2" asChild>
                                <Link href={`/documents/${doc.documentId}`}>
                                  <FileText className="h-4 w-4" />
                                  Open
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}

                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-12 text-center">
                            <div className="text-muted-foreground text-sm">
                              No documents match your search.
                            </div>
                            <div className="mt-4">
                              <Button variant="outline" onClick={clearFilters}>
                                Clear filters
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
