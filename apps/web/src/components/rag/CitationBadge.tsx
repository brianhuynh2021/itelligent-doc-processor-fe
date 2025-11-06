import { Badge } from "@/components/ui/badge"
import { FileText } from "lucide-react"

interface CitationBadgeProps {
  docName: string
  chunkIndex?: number
  onClick?: () => void
}

export function CitationBadge({ docName, chunkIndex, onClick }: CitationBadgeProps) {
  return (
    <Badge
      variant="outline"
      className="cursor-pointer hover:bg-accent transition-colors gap-1.5 px-2 py-1"
      onClick={onClick}
    >
      <FileText className="h-3 w-3" />
      <span className="text-xs font-medium">{docName}</span>
      {chunkIndex !== undefined && (
        <span className="text-xs text-muted-foreground">#{chunkIndex}</span>
      )}
    </Badge>
  )
}

