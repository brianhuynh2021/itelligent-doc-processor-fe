import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, MessageSquare, Zap, Search, Sparkles, Shield, Rocket } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 flex-1">
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

      <footer className="border-t bg-background/60">
        <div className="container mx-auto px-4 py-10">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="text-lg font-semibold mb-3">Intelligent Doc Processor</h3>
              <p className="text-sm text-muted-foreground">
                Streamline document workflows with AI-powered insights, secure processing, and collaborative tools tailored for your team.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/chat" className="hover:text-foreground transition-colors">
                      Live Chat
                    </Link>
                  </li>
                  <li>
                    <Link href="/documents" className="hover:text-foreground transition-colors">
                      Document Library
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="hover:text-foreground transition-colors">
                      Pricing
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Support</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/docs" className="hover:text-foreground transition-colors">
                      Documentation
                    </Link>
                  </li>
                  <li>
                    <Link href="/status" className="hover:text-foreground transition-colors">
                      System Status
                    </Link>
                  </li>
                  <li>
                    <Link href="/support" className="hover:text-foreground transition-colors">
                      Contact Support
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Stay in the loop</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Get product updates, release notes, and best practices straight to your inbox.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  className="flex-1"
                />
                <Button className="w-full sm:w-auto">Subscribe</Button>
              </div>
            </div>
          </div>
          <div className="mt-10 border-t pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Intelligent Doc Processor. All rights reserved.</p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}