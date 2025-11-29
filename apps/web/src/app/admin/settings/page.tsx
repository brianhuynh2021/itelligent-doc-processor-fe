"use client"

import Link from "next/link"

import { AdminLayout } from "@/components/admin/AdminLayout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

export default function AdminSettingsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure platform preferences, security, and integrations
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
                <CardDescription>Update organization details and platform branding.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="orgName">Organization name</Label>
                  <Input id="orgName" placeholder="Acme Corp" defaultValue="Acme Industries" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supportEmail">Support email</Label>
                  <Input id="supportEmail" type="email" placeholder="support@example.com" defaultValue="help@acme.io" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your organization"
                    defaultValue="AI-powered document intelligence for enterprise teams."
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <Button>Save changes</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage authentication policies and alerts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Require MFA for admins</p>
                    <p className="text-sm text-muted-foreground">Add an extra layer of protection to admin accounts.</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-5 w-5 accent-primary transition-colors"
                    aria-label="Require multi-factor authentication for admins"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Session timeout</p>
                    <p className="text-sm text-muted-foreground">Automatically sign out inactive users after 30 minutes.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-primary transition-colors"
                    aria-label="Enable session timeout"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Email notifications</p>
                    <p className="text-sm text-muted-foreground">Alert admins about unusual login activity.</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-5 w-5 accent-primary transition-colors"
                    aria-label="Enable security email notifications"
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <Button variant="outline">Update security</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>Connect third-party services to extend capabilities.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Slack Notifications</p>
                    <p className="text-sm text-muted-foreground">Send alerts to your operations channel.</p>
                  </div>
                  <Button variant="outline" size="sm">Configure</Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">S3 Storage</p>
                    <p className="text-sm text-muted-foreground">Manage external document archival.</p>
                  </div>
                  <Button variant="outline" size="sm">Manage</Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Webhook Events</p>
                    <p className="text-sm text-muted-foreground">Receive updates when documents finish processing.</p>
                  </div>
                  <Button variant="outline" size="sm">View events</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Environment</CardTitle>
                <CardDescription>Current deployment configuration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Region</span>
                  <span>us-east-1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Runtime</span>
                  <span>Next.js 14</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last deployment</span>
                  <span>2 hours ago</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Support</CardTitle>
                <CardDescription>Need a hand? We're here to help.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Contact our support team or browse documentation to troubleshoot common issues.
                </p>
                <div className="flex flex-col gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/support">Open support portal</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/docs">View documentation</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

