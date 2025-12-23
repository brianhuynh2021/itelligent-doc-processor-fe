"use client"

import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FileText, ExternalLink, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface DocumentSource {
  id: string
  name: string
  type: string
  documentId?: number
  chunkIndex: number
  preview: string
  similarity?: number
  metadata?: Record<string, unknown>
}

interface ContextPanelProps {
  sources: DocumentSource[]
  selectedSource?: DocumentSource | null
  onSelectSource?: (source: DocumentSource) => void
  onClose?: () => void
  onOpenDocument?: (documentId: number) => void
  isOpen?: boolean
}

export function ContextPanel({
  sources,
  selectedSource,
  onSelectSource,
  onClose,
  onOpenDocument,
  isOpen = true,
}: ContextPanelProps) {
  if (!isOpen) return null

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sources List */}
      <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Context Sources</h3>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {sources.length} document{sources.length !== 1 ? 's' : ''} referenced
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {sources.map((source) => (
              <Card
                key={source.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md p-3",
                  selectedSource?.id === source.id && "ring-2 ring-primary"
                )}
                onClick={() => onSelectSource?.(source)}
              >
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{source.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        Chunk #{source.chunkIndex}
                      </Badge>
                      {source.similarity && (
                        <span className="text-xs text-muted-foreground">
                          {(source.similarity * 100).toFixed(0)}% match
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Source Preview */}
      {selectedSource && (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">{selectedSource.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedSource.type} • Chunk #{selectedSource.chunkIndex}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                disabled={!selectedSource.documentId || !onOpenDocument}
                onClick={() => {
                  if (!selectedSource.documentId) return
                  onOpenDocument?.(selectedSource.documentId)
                }}
              >
                <ExternalLink className="h-4 w-4" />
                View Full Document
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              <div className="prose prose-sm max-w-none">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedSource.preview}
                </p>
              </div>

              {selectedSource.metadata && Object.keys(selectedSource.metadata).length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h4 className="text-xs font-semibold mb-2 text-muted-foreground">
                      Metadata
                    </h4>
                    <div className="space-y-1">
                      {Object.entries(selectedSource.metadata).map(([key, value]) => (
                        <div key={key} className="flex text-xs">
                          <span className="font-medium text-muted-foreground w-24">
                            {key}:
                          </span>
                          <span className="flex-1">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {!selectedSource && sources.length > 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a source to view details</p>
          </div>
        </div>
      )}
    </div>
  )
}
