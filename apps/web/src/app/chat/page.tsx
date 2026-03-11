import { Suspense } from "react"
import { RAGChat } from "@/components/rag/RAGChat"

function ChatPageContent() {
  return (
    <div className="h-full">
      <RAGChat />
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <ChatPageContent />
    </Suspense>
  )
}
