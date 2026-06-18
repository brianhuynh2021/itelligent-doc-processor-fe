"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"

import { AdminLayout } from "@/components/admin/AdminLayout"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  apiCandidates,
  getApiBaseUrl,
  readErrorMessage,
  useAuthFetch,
} from "@/lib/api"

type ApiKey = {
  id: number
  name: string
  key_prefix: string
  scopes?: string | null
  expires_at?: string | null
  last_used_at?: string | null
  revoked_at?: string | null
  created_at: string
}

type GeneralSettings = {
  orgName: string
  supportEmail: string
  description: string
}

type SecuritySettings = {
  requireMfa: boolean
  sessionTimeout: boolean
  emailAlerts: boolean
}

type FeatureFlags = {
  streamingChat: boolean
  fulltextSearch: boolean
  mcpTools: boolean
  betaAnalytics: boolean
}

const GENERAL_KEY = "admin_general_settings"
const SECURITY_KEY = "admin_security_settings"
const FLAGS_KEY = "admin_feature_flags"

const DEFAULT_GENERAL: GeneralSettings = {
  orgName: "Acme Industries",
  supportEmail: "help@acme.io",
  description: "AI-powered document intelligence for enterprise teams.",
}
const DEFAULT_SECURITY: SecuritySettings = {
  requireMfa: true,
  sessionTimeout: false,
  emailAlerts: true,
}
const DEFAULT_FLAGS: FeatureFlags = {
  streamingChat: true,
  fulltextSearch: true,
  mcpTools: false,
  betaAnalytics: false,
}

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) }
  } catch {
    return fallback
  }
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-5 w-5 accent-primary transition-colors"
      aria-label={label}
    />
  )
}

export default function AdminSettingsPage() {
  const { fetchFirstOk } = useAuthFetch()
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), [])

  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL)
  const [security, setSecurity] = useState<SecuritySettings>(DEFAULT_SECURITY)
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS)

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [keysNotice, setKeysNotice] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [creating, setCreating] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)

  const [cache, setCache] = useState<Record<string, unknown> | null>(null)
  const [cacheLoading, setCacheLoading] = useState(true)
  const [invalidating, setInvalidating] = useState(false)

  const [health, setHealth] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    setGeneral(loadLocal(GENERAL_KEY, DEFAULT_GENERAL))
    setSecurity(loadLocal(SECURITY_KEY, DEFAULT_SECURITY))
    setFlags(loadLocal(FLAGS_KEY, DEFAULT_FLAGS))
  }, [])

  const loadKeys = useCallback(async () => {
    setKeysLoading(true)
    setKeysNotice(null)
    try {
      const res = await fetchFirstOk(apiCandidates("/api-keys"))
      if (res?.ok) {
        const data = (await res.json().catch(() => [])) as ApiKey[]
        setKeys(Array.isArray(data) ? data : [])
      } else if (res?.status === 404) {
        setKeysNotice("API keys endpoint not available on this backend.")
        setKeys([])
      } else if (res) {
        throw new Error(await readErrorMessage(res, `Failed (${res.status}).`))
      }
    } catch (err) {
      setKeysNotice(err instanceof Error ? err.message : "Failed to load API keys.")
      setKeys([])
    } finally {
      setKeysLoading(false)
    }
  }, [fetchFirstOk])

  const loadCache = useCallback(async () => {
    setCacheLoading(true)
    try {
      const res = await fetchFirstOk(apiCandidates("/admin/cache/stats"))
      if (res?.ok) {
        setCache((await res.json().catch(() => null)) as Record<string, unknown>)
      } else {
        setCache(null)
      }
    } catch {
      setCache(null)
    } finally {
      setCacheLoading(false)
    }
  }, [fetchFirstOk])

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetchFirstOk(apiCandidates("/health"))
      if (res?.ok) {
        setHealth((await res.json().catch(() => null)) as Record<string, unknown>)
      } else {
        setHealth(null)
      }
    } catch {
      setHealth(null)
    }
  }, [fetchFirstOk])

  useEffect(() => {
    void loadKeys()
    void loadCache()
    void loadHealth()
  }, [loadKeys, loadCache, loadHealth])

  const saveGeneral = () => {
    localStorage.setItem(GENERAL_KEY, JSON.stringify(general))
    toast.success("General settings saved")
  }
  const saveSecurity = (next: SecuritySettings) => {
    setSecurity(next)
    localStorage.setItem(SECURITY_KEY, JSON.stringify(next))
  }
  const saveFlags = (next: FeatureFlags) => {
    setFlags(next)
    localStorage.setItem(FLAGS_KEY, JSON.stringify(next))
    toast.success("Feature flags updated")
  }

  const createKey = useCallback(async () => {
    const name = newKeyName.trim()
    if (!name) {
      toast.error("Enter a name for the key.")
      return
    }
    setCreating(true)
    try {
      const res = await fetchFirstOk(apiCandidates("/api-keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (res?.ok) {
        const data = (await res.json()) as ApiKey & { plaintext_key: string }
        setRevealedKey(data.plaintext_key)
        setCreateOpen(false)
        setNewKeyName("")
        toast.success("API key created")
        void loadKeys()
        return
      }
      throw new Error(await readErrorMessage(res!, `Failed (${res?.status}).`))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key.")
    } finally {
      setCreating(false)
    }
  }, [fetchFirstOk, loadKeys, newKeyName])

  const revokeKey = useCallback(async () => {
    if (!revokeTarget) return
    const target = revokeTarget
    setRevokeTarget(null)
    try {
      const res = await fetchFirstOk(apiCandidates(`/api-keys/${target.id}`), {
        method: "DELETE",
      })
      if (res?.ok || res?.status === 204) {
        toast.success(`Revoked "${target.name}"`)
        void loadKeys()
        return
      }
      throw new Error(await readErrorMessage(res!, `Failed (${res?.status}).`))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke key.")
    }
  }, [fetchFirstOk, loadKeys, revokeTarget])

  const invalidateCache = useCallback(async () => {
    setInvalidating(true)
    try {
      const res = await fetchFirstOk(apiCandidates("/admin/cache/invalidate"), {
        method: "POST",
        query: { namespace: "search" },
      })
      if (res?.ok) {
        const data = (await res.json().catch(() => ({}))) as { removed?: number }
        toast.success(`Cleared search cache (${data.removed ?? 0} entries)`)
        void loadCache()
        return
      }
      throw new Error(await readErrorMessage(res!, `Failed (${res?.status}).`))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear cache.")
    } finally {
      setInvalidating(false)
    }
  }, [fetchFirstOk, loadCache])

  const featureFlagItems: { key: keyof FeatureFlags; label: string; desc: string }[] =
    [
      {
        key: "streamingChat",
        label: "Streaming chat",
        desc: "Token-by-token streaming in the RAG chat.",
      },
      {
        key: "fulltextSearch",
        label: "Full-text search",
        desc: "Keyword search alongside vector search.",
      },
      {
        key: "mcpTools",
        label: "MCP tools",
        desc: "Expose document tools over the Model Context Protocol.",
      },
      {
        key: "betaAnalytics",
        label: "Beta analytics",
        desc: "Experimental analytics widgets and cost modeling.",
      },
    ]

  const healthStatus =
    (health?.status as string) ?? (health ? "ok" : "unknown")

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
            {/* General */}
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
                <CardDescription>
                  Update organization details and platform branding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="orgName">Organization name</Label>
                  <Input
                    id="orgName"
                    value={general.orgName}
                    onChange={(e) =>
                      setGeneral({ ...general, orgName: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supportEmail">Support email</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={general.supportEmail}
                    onChange={(e) =>
                      setGeneral({ ...general, supportEmail: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={general.description}
                    onChange={(e) =>
                      setGeneral({ ...general, description: e.target.value })
                    }
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <Button onClick={saveGeneral}>Save changes</Button>
              </CardFooter>
            </Card>

            {/* API Keys */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    API Keys
                  </CardTitle>
                  <CardDescription>
                    Programmatic access tokens for your account.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={loadKeys}
                    disabled={keysLoading}
                  >
                    {keysLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    New key
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {keysNotice ? (
                  <p className="text-sm text-muted-foreground">{keysNotice}</p>
                ) : keysLoading ? (
                  <p className="text-sm text-muted-foreground">Loading keys…</p>
                ) : keys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No API keys yet. Create one to integrate external services.
                  </p>
                ) : (
                  keys.map((key) => {
                    const revoked = Boolean(key.revoked_at)
                    return (
                      <div
                        key={key.id}
                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{key.name}</span>
                            {revoked ? (
                              <Badge variant="destructive">revoked</Badge>
                            ) : (
                              <Badge variant="outline">active</Badge>
                            )}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {key.key_prefix}••••••••
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Created{" "}
                            {new Date(key.created_at).toLocaleDateString()}
                            {key.last_used_at
                              ? ` · last used ${new Date(
                                  key.last_used_at,
                                ).toLocaleDateString()}`
                              : " · never used"}
                          </div>
                        </div>
                        {!revoked && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setRevokeTarget(key)}
                            aria-label={`Revoke ${key.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>

            {/* Security */}
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Manage authentication policies and alerts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Require MFA for admins</p>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of protection to admin accounts.
                    </p>
                  </div>
                  <Toggle
                    checked={security.requireMfa}
                    onChange={(v) =>
                      saveSecurity({ ...security, requireMfa: v })
                    }
                    label="Require multi-factor authentication for admins"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Session timeout</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically sign out inactive users after 30 minutes.
                    </p>
                  </div>
                  <Toggle
                    checked={security.sessionTimeout}
                    onChange={(v) =>
                      saveSecurity({ ...security, sessionTimeout: v })
                    }
                    label="Enable session timeout"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Email notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Alert admins about unusual login activity.
                    </p>
                  </div>
                  <Toggle
                    checked={security.emailAlerts}
                    onChange={(v) =>
                      saveSecurity({ ...security, emailAlerts: v })
                    }
                    label="Enable security email notifications"
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <span className="text-xs text-muted-foreground">
                  Saved automatically
                </span>
              </CardFooter>
            </Card>

            {/* Feature flags */}
            <Card>
              <CardHeader>
                <CardTitle>Feature flags</CardTitle>
                <CardDescription>
                  Toggle modules on/off for your environment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {featureFlagItems.map((item, i) => (
                  <div key={item.key}>
                    {i > 0 && <Separator className="mb-4" />}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.desc}
                        </p>
                      </div>
                      <Toggle
                        checked={flags[item.key]}
                        onChange={(v) => saveFlags({ ...flags, [item.key]: v })}
                        label={`Toggle ${item.label}`}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Cache management */}
            <Card>
              <CardHeader>
                <CardTitle>Search cache</CardTitle>
                <CardDescription>
                  Cache counters since process start.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {cacheLoading ? (
                  <p className="text-muted-foreground">Loading…</p>
                ) : cache ? (
                  Object.entries(cache).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="capitalize text-muted-foreground">
                        {k.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium tabular-nums">
                        {typeof v === "number" ? v.toLocaleString() : String(v)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">
                    Cache stats unavailable.
                  </p>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={invalidateCache}
                  disabled={invalidating}
                >
                  {invalidating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Clear search cache
                </Button>
              </CardFooter>
            </Card>

            {/* Environment */}
            <Card>
              <CardHeader>
                <CardTitle>Environment</CardTitle>
                <CardDescription>Current deployment configuration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Backend health</span>
                  <Badge
                    variant={
                      healthStatus === "ok" || healthStatus === "healthy"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {healthStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">API base</span>
                  <span className="truncate font-mono text-xs">
                    {apiBaseUrl || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Runtime</span>
                  <span>Next.js 15</span>
                </div>
              </CardContent>
            </Card>

            {/* Support */}
            <Card>
              <CardHeader>
                <CardTitle>Support</CardTitle>
                <CardDescription>
                  Need a hand? We&apos;re here to help.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Contact our support team or browse documentation to troubleshoot
                  common issues.
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

      {/* Create key dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Give the key a descriptive name. The secret is shown only once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              placeholder="e.g. CI pipeline"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createKey} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal-once dialog */}
      <Dialog
        open={revealedKey !== null}
        onOpenChange={(open) => !open && setRevealedKey(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your API key now</DialogTitle>
            <DialogDescription>
              This is the only time the full key is shown. Store it somewhere safe.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
            <code className="flex-1 break-all font-mono text-sm">
              {revealedKey}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (revealedKey) {
                  void navigator.clipboard.writeText(revealedKey)
                  toast.success("Copied to clipboard")
                }
              }}
              aria-label="Copy API key"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Revoking &quot;{revokeTarget?.name}&quot; immediately disables any
              integration using it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={revokeKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}
