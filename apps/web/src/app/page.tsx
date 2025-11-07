import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, MessageSquare, Zap, Search, Sparkles, Shield, Rocket } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-80px)]">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Intelligent Doc Processor
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            AI-powered document processing platform with RAG capabilities
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/chat">
                <MessageSquare className="mr-2 h-5 w-5" />
                Start Chat
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/documents">
                <FileText className="mr-2 h-5 w-5" />
                View Documents
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>RAG Chat Interface</CardTitle>
              <CardDescription>
                Ask questions and get AI-powered answers with source citations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="link" className="p-0">
                <Link href="/chat">Try it now →</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Context-Aware Search</CardTitle>
              <CardDescription>
                Intelligent document search with semantic understanding
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Real-time Processing</CardTitle>
              <CardDescription>
                Fast document processing with streaming responses
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>AI-Powered Insights</CardTitle>
              <CardDescription>
                Get intelligent insights and summaries from your documents
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>
                Enterprise-grade security with end-to-end encryption
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>
                Optimized performance for instant document processing
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}