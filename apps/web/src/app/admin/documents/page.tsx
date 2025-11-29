"use client"

import { AdminLayout } from "@/components/admin/AdminLayout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, UploadCloud, Filter, PlusCircle } from "lucide-react"

const documents = [
  {
    id: "DOC-001",
    name: "Marketing Strategy Q4.pdf",
    owner: "Sarah Chen",
    updatedAt: "2 hours ago",
    status: "Processed",
    tags: ["Marketing", "Q4"],
  },
  {
    id: "DOC-002",
    name: "Financial Report 2025.xlsx",
    owner: "James Wilson",
    updatedAt: "5 hours ago",
    status: "Processing",
    tags: ["Finance"],
  },
  {
    id: "DOC-003",
    name: "Product Roadmap.docx",
    owner: "Priya Patel",
    updatedAt: "1 day ago",
    status: "Processed",
    tags: ["Product", "Roadmap"],
  },
  {
    id: "DOC-004",
    name: "Customer Feedback.csv",
    owner: "Alex Martinez",
    updatedAt: "2 days ago",
    status: "Pending",
    tags: ["Support"],
  },
]

export default function AdminDocumentsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Documents</h1>
            <p className="text-muted-foreground">
              Monitor and manage uploaded documents across the platform
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button variant="outline" className="gap-2">
              <UploadCloud className="h-4 w-4" />
              Upload
            </Button>
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              New Document
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium">Documents</CardTitle>
                <CardDescription>Total files uploaded</CardDescription>
              </div>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">3,456</div>
              <p className="text-xs text-muted-foreground">+128 this month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Processing Queue</CardTitle>
              <CardDescription>Documents currently being processed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">18</div>
              <p className="text-xs text-muted-foreground">Average time: 42s</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CardDescription>Completed without issues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">99.2%</div>
              <p className="text-xs text-green-600">Up 1.3% from last week</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
            <CardDescription>Most recent uploads and their processing status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.id}</TableCell>
                      <TableCell>{doc.name}</TableCell>
                      <TableCell>{doc.owner}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            doc.status === "Processed"
                              ? "default"
                              : doc.status === "Processing"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {doc.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {doc.updatedAt}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

