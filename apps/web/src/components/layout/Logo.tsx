import Link from "next/link"
import { FileText, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  showText?: boolean
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 group transition-all",
        className
      )}
    >
      <div className="relative">
        {/* Icon container with gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60 rounded-lg blur-sm opacity-50 group-hover:opacity-75 transition-opacity" />
        <div className="relative bg-gradient-to-br from-primary to-primary/80 p-2 rounded-lg shadow-lg group-hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            <Sparkles className="h-3 w-3 text-primary-foreground -ml-2 -mt-1" strokeWidth={2.5} />
          </div>
        </div>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary/70 transition-all">
            Intelligent Doc
          </span>
          <span className="text-xs text-muted-foreground -mt-1">
            Processor
          </span>
        </div>
      )}
    </Link>
  )
}

