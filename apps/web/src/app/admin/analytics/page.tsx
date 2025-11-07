"use client"

import { AdminLayout } from "@/components/admin/AdminLayout"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Users, BarChart3, ArrowUpRight, AlertTriangle } from "lucide-react"

const kpis = [
  {
    title: "Active Users",
    value: "892",
    description: "+12% vs last month",
    icon: Users,
  },
  {
    title: "Document Processing",
    value: "3,456",
    description: "98.9% success rate",
    icon: BarChart3,
  },
  {
    title: "Avg. Response Time",
    value: "420ms",
    description: "-8% vs last week",
    icon: TrendingUp,
  },
]

const alerts = [
  {
    id: 1,
    title: "Spike in document uploads",
    detail: "Upload volume increased by 34% in the last hour.",
    severity: "medium",
  },
  {
    id: 2,
    title: "Latency normalized",
    detail: "Response times returned to baseline for chat service.",
    severity: "low",
  },
]

export default function AdminAnalyticsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">
              Track platform performance, usage, and operational health
            </p>
          </div>
          <Button className="w-fit gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {kpis.map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{item.value}</div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Tabs defaultValue="usage" className="space-y-4">
          <TabsList>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="reliability">Reliability</TabsTrigger>
          </TabsList>
          <TabsContent value="usage">
            <Card>
              <CardHeader>
                <CardTitle>Usage Overview</CardTitle>
                <CardDescription>Weekly trends across key product areas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72 border border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                  <p>Usage charts will render here.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Latency and throughput across services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72 border border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                  <p>Performance charts will render here.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="reliability">
            <Card>
              <CardHeader>
                <CardTitle>Reliability Metrics</CardTitle>
                <CardDescription>System uptime and error rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72 border border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                  <p>Reliability charts will render here.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Operational Alerts</CardTitle>
            <CardDescription>Real-time notifications that may require attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-md border p-4"
                >
                  <div className="mt-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-medium">{alert.title}</h3>
                      <Badge variant="outline" className="uppercase tracking-wide">
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

