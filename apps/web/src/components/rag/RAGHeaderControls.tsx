"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenuCheckboxItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Database, PanelRightClose, PanelRightOpen, Settings2 } from "lucide-react"

export type RetrievalMode = "semantic" | "hybrid"

export interface RAGCollectionOption {
  id: string
  label: string
}

export interface RAGDocumentOption {
  id: number
  label: string
}

export interface RAGSettings {
  collectionId: string
  mode: RetrievalMode
  topK: number
  minScore: number
  includeCitations: boolean
  stream: boolean
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function RAGHeaderControls({
  sourcesCount,
  isContextOpen,
  onToggleContext,
  collections,
  documents,
  selectedDocumentId,
  onChangeSelectedDocumentId,
  settings,
  onChangeSettings,
}: {
  sourcesCount: number
  isContextOpen: boolean
  onToggleContext: () => void
  collections: RAGCollectionOption[]
  documents: RAGDocumentOption[]
  selectedDocumentId: number | null
  onChangeSelectedDocumentId: (documentId: number | null) => void
  settings: RAGSettings
  onChangeSettings: (next: RAGSettings) => void
}) {
  const activeCollection =
    collections.find((c) => c.id === settings.collectionId)?.label || "Collection"

  return (
    <div className="flex items-center gap-2">
      {sourcesCount > 0 && (
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {sourcesCount} source{sourcesCount !== 1 ? "s" : ""}
        </Badge>
      )}

      <DropdownMenu>
        <Button variant="outline" className="gap-2 h-9">
          <Database className="h-4 w-4" />
          <span className="hidden md:inline">{activeCollection}</span>
          <span className="md:hidden">RAG</span>
        </Button>

        <DropdownMenuContent align="end" className="w-[320px] p-2">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Retrieval settings
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <div className="px-2 py-2 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Knowledge base</Label>
              <DropdownMenuRadioGroup
                value={settings.collectionId}
                onValueChange={(collectionId) =>
                  onChangeSettings({ ...settings, collectionId })
                }
              >
                {collections.map((c) => (
                  <DropdownMenuRadioItem key={c.id} value={c.id}>
                    {c.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <DropdownMenuRadioGroup
                value={settings.mode}
                onValueChange={(mode) =>
                  onChangeSettings({ ...settings, mode: mode as RetrievalMode })
                }
              >
                <DropdownMenuRadioItem value="semantic">Semantic</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="hybrid">Hybrid</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <div className="space-y-1.5">
              <Label htmlFor="rag-document-scope" className="text-xs text-muted-foreground">
                Document scope
              </Label>
              <select
                id="rag-document-scope"
                className="border-input shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
                value={selectedDocumentId ?? ""}
                onChange={(e) => {
                  const value = e.target.value
                  onChangeSelectedDocumentId(value ? Number(value) : null)
                }}
              >
                <option value="">All documents</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.label}
                  </option>
                ))}
              </select>
            </div>

            <DropdownMenuSeparator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rag-topk" className="text-xs text-muted-foreground">
                  Top K
                </Label>
                <Input
                  id="rag-topk"
                  type="number"
                  min={1}
                  max={50}
                  value={settings.topK}
                  onChange={(e) =>
                    onChangeSettings({
                      ...settings,
                      topK: clampNumber(Number(e.target.value), 1, 50),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rag-minscore" className="text-xs text-muted-foreground">
                  Min score
                </Label>
                <Input
                  id="rag-minscore"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.minScore}
                  onChange={(e) =>
                    onChangeSettings({
                      ...settings,
                      minScore: clampNumber(Number(e.target.value), 0, 1),
                    })
                  }
                />
              </div>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuCheckboxItem
              checked={settings.stream}
              onCheckedChange={(next) =>
                onChangeSettings({
                  ...settings,
                  stream: Boolean(next),
                })
              }
            >
              Use WebSocket stream
            </DropdownMenuCheckboxItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        disabled={sourcesCount === 0}
        onClick={onToggleContext}
        aria-label={isContextOpen ? "Close context panel" : "Open context panel"}
      >
        {isContextOpen ? (
          <PanelRightClose className="h-4 w-4" />
        ) : (
          <PanelRightOpen className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
