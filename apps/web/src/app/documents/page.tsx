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
  Download,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
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

type IngestionResponse = {
  document: BackendDocument
  total_duration_ms: number
  chunks_indexed: number
}

type FileMetadataResponse = {
  file_id: string
  filename: string
  url?: string | null
}

type FileListItem = {
  file_id: string
  filename: string
  path: string
}

type FileListResponse = {
  items: FileListItem[]
  total: number
}

type RAGDocumentRow = {
  id: string
  documentId: number
  name: string
  filePath: string
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

const COLLECTION_STORAGE_KEY = 'rag_collection_by_doc_id'
const FILE_ID_STORAGE_KEY = 'rag_file_id_by_doc_id'

function isRagCollectionId(value: string): value is RAGCollectionId {
  return COLLECTIONS.some((collection) => collection.id === value)
}

function parseCollectionMap(raw: string | null): Record<number, RAGCollectionId> {
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return {}

    const entries = Object.entries(parsed)
      .map(([key, value]) => {
        const documentId = Number(key)
        if (!Number.isFinite(documentId)) return null
        if (typeof value !== 'string' || !isRagCollectionId(value)) return null
        return [documentId, value] as const
      })
      .filter((entry): entry is readonly [number, RAGCollectionId] => entry != null)

    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

function parseFileIdMap(raw: string | null): Record<number, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return {}
    const entries = Object.entries(parsed)
      .map(([key, value]) => {
        const documentId = Number(key)
        if (!Number.isFinite(documentId)) return null
        if (typeof value !== 'string' || !value.trim()) return null
        return [documentId, value.trim()] as const
      })
      .filter((entry): entry is readonly [number, string] => entry != null)
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

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
    filePath: doc.file_path,
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
  const [ingestingDocIds, setIngestingDocIds] = useState<number[]>([])
  const [fileIdByDocId, setFileIdByDocId] = useState<Record<number, string>>({})
  const [hasLoadedCollectionMap, setHasLoadedCollectionMap] = useState(false)
  const [hasLoadedFileMap, setHasLoadedFileMap] = useState(false)

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(COLLECTION_STORAGE_KEY)
    setCollectionByDocId(parseCollectionMap(stored))
    setHasLoadedCollectionMap(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(FILE_ID_STORAGE_KEY)
    setFileIdByDocId(parseFileIdMap(stored))
    setHasLoadedFileMap(true)
  }, [])

  useEffect(() => {
    if (!hasLoadedCollectionMap || typeof window === 'undefined') return
    window.localStorage.setItem(
      COLLECTION_STORAGE_KEY,
      JSON.stringify(collectionByDocId),
    )
  }, [collectionByDocId, hasLoadedCollectionMap])

  useEffect(() => {
    if (!hasLoadedFileMap || typeof window === 'undefined') return
    window.localStorage.setItem(FILE_ID_STORAGE_KEY, JSON.stringify(fileIdByDocId))
  }, [fileIdByDocId, hasLoadedFileMap])

  const loadDocuments = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setIsLoadingDocs(true)
      setLoadError(null)

      if (!apiBaseUrl) {
        setLoadError(
          'Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.',
        )
        if (!silent) setIsLoadingDocs(false)
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

        const nextDocs = data.items.map((item) =>
          mapDocumentToRow(item, collectionByDocId),
        )
        setDocs(nextDocs)

        const missingFileIds = nextDocs.some(
          (item) => !fileIdByDocId[item.documentId],
        )
        if (missingFileIds) {
          try {
            const filesUrl = new URL('/api/v1/files', apiBaseUrl)
            filesUrl.searchParams.set('skip', '0')
            filesUrl.searchParams.set('limit', '200')
            const filesRes = await authFetch(filesUrl.toString(), { method: 'GET' })
            if (filesRes.ok) {
              const filesData = (await filesRes
                .json()
                .catch(() => null)) as FileListResponse | null
              if (filesData?.items && Array.isArray(filesData.items)) {
                const fileIdPatch = filesData.items.reduce<Record<number, string>>(
                  (acc, file) => {
                    const matchedDoc = nextDocs.find(
                      (doc) =>
                        doc.filePath === file.path ||
                        (doc.name === file.filename && !fileIdByDocId[doc.documentId]),
                    )
                    if (matchedDoc) {
                      acc[matchedDoc.documentId] = file.file_id
                    }
                    return acc
                  },
                  {},
                )

                if (Object.keys(fileIdPatch).length > 0) {
                  setFileIdByDocId((prev) => ({ ...prev, ...fileIdPatch }))
                }
              }
            }
          } catch {
            // Keep actions available for docs uploaded in this session even if file list lookup fails.
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load documents.'
        setLoadError(message)
        if (!silent) toast.error(message)
      } finally {
        if (!silent) setIsLoadingDocs(false)
      }
    },
    [apiBaseUrl, authFetch, collectionByDocId, fileIdByDocId],
  )

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const hasActiveProcessing = useMemo(
    () =>
      docs.some(
        (d) => d.ingest.status === 'processing' || d.index.status === 'indexing',
      ),
    [docs],
  )

  useEffect(() => {
    if (!hasActiveProcessing || typeof window === 'undefined') return

    const timer = window.setInterval(() => {
      void loadDocuments({ silent: true })
    }, 4000)

    return () => window.clearInterval(timer)
  }, [hasActiveProcessing, loadDocuments])

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

      if (
        typeof data?.document_id === 'number' &&
        typeof data?.file_id === 'string' &&
        data.file_id
      ) {
        setFileIdByDocId((prev) => ({
          ...prev,
          [data.document_id as number]: data.file_id as string,
        }))
      }

      await loadDocuments({ silent: true })

      if (typeof data?.document_id === 'number') {
        toast.info(`Auto-ingest started for Document #${data.document_id}.`)
        void ingestDocument(data.document_id)
      }
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

  const ingestDocument = useCallback(
    async (documentId: number) => {
      if (!apiBaseUrl) {
        toast.error(
          'Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.',
        )
        return
      }

      setIngestingDocIds((prev) =>
        prev.includes(documentId) ? prev : [...prev, documentId],
      )

      try {
        const url = new URL(`/api/v1/documents/${documentId}/ingest`, apiBaseUrl)
        url.searchParams.set('chunk_size', '1000')
        url.searchParams.set('chunk_overlap', '200')

        const res = await authFetch(url.toString(), { method: 'POST' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const message =
            body?.detail || body?.message || `Ingest failed (${res.status}).`
          throw new Error(message)
        }

        const data = (await res
          .json()
          .catch(() => null)) as IngestionResponse | null
        const indexedChunks = data?.chunks_indexed

        toast.success(
          indexedChunks != null
            ? `Document #${documentId} ingested (${indexedChunks} chunks indexed).`
            : `Document #${documentId} ingested successfully.`,
        )

        await loadDocuments({ silent: true })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to ingest document.'
        toast.error(`Document #${documentId}: ${message}`)
      } finally {
        setIngestingDocIds((prev) => prev.filter((id) => id !== documentId))
      }
    },
    [apiBaseUrl, authFetch, loadDocuments],
  )

  const getFileIdForDocument = useCallback(
    (documentId: number) => fileIdByDocId[documentId] ?? null,
    [fileIdByDocId],
  )

  const downloadDocumentFile = useCallback(
    async (documentId: number) => {
      if (!apiBaseUrl) {
        toast.error(
          'Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.',
        )
        return
      }

      const fileId = getFileIdForDocument(documentId)
      if (!fileId) {
        toast.error(`Missing file_id for Document #${documentId}.`)
        return
      }

      try {
        const metadataUrl = new URL(`/api/v1/files/${fileId}`, apiBaseUrl)
        const metadataRes = await authFetch(metadataUrl.toString(), { method: 'GET' })
        if (!metadataRes.ok) {
          const body = await metadataRes.json().catch(() => ({}))
          const message =
            body?.detail ||
            body?.message ||
            `File metadata failed (${metadataRes.status}).`
          throw new Error(message)
        }

        const metadata = (await metadataRes
          .json()
          .catch(() => null)) as FileMetadataResponse | null

        const downloadPath = metadata?.url || `/api/v1/files/${fileId}/download`
        const downloadUrl = new URL(downloadPath, apiBaseUrl)
        const downloadRes = await authFetch(downloadUrl.toString(), {
          method: 'GET',
        })
        if (!downloadRes.ok) {
          const body = await downloadRes.json().catch(() => ({}))
          const message =
            body?.detail ||
            body?.message ||
            `Download failed (${downloadRes.status}).`
          throw new Error(message)
        }

        const blob = await downloadRes.blob()
        const objectUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = metadata?.filename || `${fileId}`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(objectUrl)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to download file.'
        toast.error(message)
      }
    },
    [apiBaseUrl, authFetch, getFileIdForDocument],
  )

  const deleteDocumentFile = useCallback(
    async (documentId: number) => {
      if (!apiBaseUrl) {
        toast.error(
          'Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.',
        )
        return
      }

      const fileId = getFileIdForDocument(documentId)
      if (!fileId) {
        toast.error(`Missing file_id for Document #${documentId}.`)
        return
      }

      const confirmed = window.confirm(
        `Delete file ${fileId} for Document #${documentId}?`,
      )
      if (!confirmed) return

      try {
        const url = new URL(`/api/v1/files/${fileId}`, apiBaseUrl)
        const res = await authFetch(url.toString(), { method: 'DELETE' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const message =
            body?.detail || body?.message || `Delete file failed (${res.status}).`
          throw new Error(message)
        }

        setFileIdByDocId((prev) => {
          const next = { ...prev }
          delete next[documentId]
          return next
        })
        toast.success(`Deleted file ${fileId}.`)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete file.'
        toast.error(message)
      }
    },
    [apiBaseUrl, authFetch, getFileIdForDocument],
  )

  const deleteDocumentRecord = useCallback(
    async (documentId: number) => {
      if (!apiBaseUrl) {
        toast.error(
          'Missing API base URL. Set NEXT_PUBLIC_BASE_URL and restart the dev server.',
        )
        return
      }

      const confirmed = window.confirm(`Delete Document #${documentId}?`)
      if (!confirmed) return

      try {
        const url = new URL(`/api/v1/documents/${documentId}`, apiBaseUrl)
        const res = await authFetch(url.toString(), { method: 'DELETE' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const message =
            body?.detail || body?.message || `Delete document failed (${res.status}).`
          throw new Error(message)
        }

        setDocs((prev) => prev.filter((doc) => doc.documentId !== documentId))
        setFileIdByDocId((prev) => {
          const next = { ...prev }
          delete next[documentId]
          return next
        })
        setCollectionByDocId((prev) => {
          const next = { ...prev }
          delete next[documentId]
          return next
        })
        toast.success(`Deleted Document #${documentId}.`)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete document.'
        toast.error(message)
      }
    },
    [apiBaseUrl, authFetch],
  )

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
              Generation. Supported: PDF, DOCX, TXT, CSV, XLSX, PNG, JPEG.
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
                          <TableCell className="align-top">
                            <div className="max-w-[28rem] space-y-1">
                              <div className="break-all font-medium leading-snug">
                                {doc.name}
                              </div>
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
                            <div className="flex flex-wrap justify-end gap-2">
                              {(() => {
                                const isIngesting = ingestingDocIds.includes(
                                  doc.documentId,
                                )
                                const actionLabel =
                                  doc.index.status === 'indexed'
                                    ? 'Reindex'
                                    : 'Ingest'

                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    disabled={isIngesting}
                                    onClick={() => {
                                      void ingestDocument(doc.documentId)
                                    }}
                                  >
                                    {isIngesting ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                    {isIngesting ? 'Running...' : actionLabel}
                                  </Button>
                                )
                              })()}
                              <Button variant="outline" size="sm" className="gap-2" asChild>
                                <Link
                                  href={`/chat?document_id=${doc.documentId}&collection=${doc.collectionId}&new=1`}
                                >
                                  <MessageSquare className="h-4 w-4" />
                                  Ask
                                </Link>
                              </Button>
                              <Button variant="outline" size="sm" className="gap-2" asChild>
                                <Link href={`/search?document_id=${doc.documentId}`}>
                                  <Search className="h-4 w-4" />
                                  Search
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={!getFileIdForDocument(doc.documentId)}
                                title={
                                  getFileIdForDocument(doc.documentId)
                                    ? `Download file ${getFileIdForDocument(doc.documentId)}`
                                    : 'File ID is unavailable for this document.'
                                }
                                onClick={() => {
                                  void downloadDocumentFile(doc.documentId)
                                }}
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                title={
                                  getFileIdForDocument(doc.documentId)
                                    ? `Delete file ${getFileIdForDocument(doc.documentId)}`
                                    : `File already missing. Delete Document #${doc.documentId} instead.`
                                }
                                onClick={() => {
                                  if (getFileIdForDocument(doc.documentId)) {
                                    void deleteDocumentFile(doc.documentId)
                                    return
                                  }
                                  void deleteDocumentRecord(doc.documentId)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                {getFileIdForDocument(doc.documentId)
                                  ? 'Delete file'
                                  : 'Delete document'}
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
