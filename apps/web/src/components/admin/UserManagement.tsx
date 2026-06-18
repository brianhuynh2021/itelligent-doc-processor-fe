"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Ban,
  CheckCircle2,
  Edit,
  Loader2,
  Mail,
  MoreVertical,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  TriangleAlert,
  UserPlus,
} from "lucide-react"

import {
  apiCandidates,
  readErrorMessage,
  useAuthFetch,
} from "@/lib/api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type UserStatus = "active" | "suspended" | "inactive"
type UserRole = "user" | "admin" | "moderator"

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
  lastLogin: string | null
  documentsCount: number
  avatar: string | null
}

type AuditEntry = {
  id: string
  actor: string
  action: string
  target: string
  at: string
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  user: ["Upload documents", "Search & chat", "Manage own files"],
  moderator: [
    "All user permissions",
    "Review flagged documents",
    "View other users' documents",
  ],
  admin: [
    "All moderator permissions",
    "Manage users & roles",
    "Platform settings & API keys",
  ],
}

// Demo directory — used when the backend user-directory endpoint is unavailable.
const demoUsers: User[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@example.com",
    role: "user",
    status: "active",
    createdAt: "2024-01-15",
    lastLogin: "2024-11-06",
    documentsCount: 12,
    avatar: null,
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane.smith@example.com",
    role: "admin",
    status: "active",
    createdAt: "2024-02-20",
    lastLogin: "2024-11-06",
    documentsCount: 45,
    avatar: null,
  },
  {
    id: "3",
    name: "Bob Johnson",
    email: "bob.johnson@example.com",
    role: "user",
    status: "suspended",
    createdAt: "2024-03-10",
    lastLogin: "2024-10-28",
    documentsCount: 8,
    avatar: null,
  },
  {
    id: "4",
    name: "Alice Brown",
    email: "alice.brown@example.com",
    role: "user",
    status: "active",
    createdAt: "2024-04-05",
    lastLogin: "2024-11-05",
    documentsCount: 23,
    avatar: null,
  },
  {
    id: "5",
    name: "Charlie Wilson",
    email: "charlie.wilson@example.com",
    role: "moderator",
    status: "active",
    createdAt: "2024-05-12",
    lastLogin: "2024-11-06",
    documentsCount: 67,
    avatar: null,
  },
]

function normalizeRole(value: unknown, isAdmin?: boolean): UserRole {
  const raw = typeof value === "string" ? value.toLowerCase() : ""
  if (raw === "admin" || raw === "administrator" || isAdmin) return "admin"
  if (raw === "moderator" || raw === "mod") return "moderator"
  return "user"
}

function normalizeUser(raw: Record<string, unknown>): User {
  const id = String(raw.id ?? raw.user_id ?? raw.uuid ?? crypto.randomUUID())
  const email = String(raw.email ?? raw.username ?? "")
  const name = String(
    raw.name ?? raw.full_name ?? raw.username ?? email.split("@")[0] ?? "Unknown",
  )
  const isActive = raw.is_active
  const status: UserStatus =
    raw.status === "suspended" || raw.is_suspended === true
      ? "suspended"
      : isActive === false
        ? "inactive"
        : "active"
  return {
    id,
    name,
    email,
    role: normalizeRole(raw.role, raw.is_admin === true || raw.is_superuser === true),
    status,
    createdAt: String(raw.created_at ?? raw.createdAt ?? "").slice(0, 10),
    lastLogin: raw.last_login
      ? String(raw.last_login).slice(0, 10)
      : (raw.lastLogin as string) ?? null,
    documentsCount: Number(raw.documents_count ?? raw.documentsCount ?? 0),
    avatar: null,
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getStatusBadgeVariant(status: UserStatus) {
  switch (status) {
    case "active":
      return "default" as const
    case "suspended":
      return "destructive" as const
    default:
      return "secondary" as const
  }
}

function getRoleBadgeVariant(role: UserRole) {
  switch (role) {
    case "admin":
      return "default" as const
    case "moderator":
      return "secondary" as const
    default:
      return "outline" as const
  }
}

export function UserManagement() {
  const { fetchFirstOk } = useAuthFetch()

  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLiveData, setIsLiveData] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all")

  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [detailUser, setDetailUser] = useState<User | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("user")
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])

  const recordAudit = useCallback(
    (action: string, target: string) => {
      setAuditLog((prev) =>
        [
          {
            id: crypto.randomUUID(),
            actor: "you",
            action,
            target,
            at: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 50),
      )
    },
    [],
  )

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setNotice(null)
    try {
      const res = await fetchFirstOk(apiCandidates("/admin/users"), {
        query: { limit: "100" },
      })
      if (res?.ok) {
        const data = (await res.json().catch(() => null)) as unknown
        const list = Array.isArray(data)
          ? data
          : Array.isArray((data as { items?: unknown })?.items)
            ? (data as { items: unknown[] }).items
            : null
        if (list) {
          setUsers(list.map((u) => normalizeUser(u as Record<string, unknown>)))
          setIsLiveData(true)
          return
        }
        throw new Error("Unexpected response from users endpoint.")
      }
      if (res && res.status !== 404) {
        throw new Error(await readErrorMessage(res, `Failed to load users (${res.status}).`))
      }
      // 404 → endpoint not implemented yet; fall back to demo directory.
      setUsers(demoUsers)
      setIsLiveData(false)
      setNotice(
        "Live user-directory endpoint (/admin/users) is not available on the backend yet. Showing a demo directory — actions here are applied locally only.",
      )
    } catch (err) {
      setUsers(demoUsers)
      setIsLiveData(false)
      setNotice(
        err instanceof Error
          ? `${err.message} Showing demo directory instead.`
          : "Failed to load users. Showing demo directory instead.",
      )
    } finally {
      setIsLoading(false)
    }
  }, [fetchFirstOk])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const q = searchQuery.toLowerCase()
        const matchesSearch =
          user.name.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q)
        const matchesRole = roleFilter === "all" || user.role === roleFilter
        const matchesStatus =
          statusFilter === "all" || user.status === statusFilter
        return matchesSearch && matchesRole && matchesStatus
      }),
    [users, searchQuery, roleFilter, statusFilter],
  )

  // Best-effort mutation: try the backend, otherwise apply locally (demo mode).
  const mutateUser = useCallback(
    async (
      user: User,
      patch: Partial<Pick<User, "role" | "status" | "name" | "email">>,
      auditAction: string,
    ) => {
      const apply = () =>
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, ...patch } : u)),
        )

      if (!isLiveData) {
        apply()
        recordAudit(auditAction, user.email)
        toast.success(`${auditAction} (local demo)`)
        return
      }

      try {
        const body: Record<string, unknown> = {}
        if (patch.role) body.role = patch.role
        if (patch.status) {
          body.is_active = patch.status !== "suspended"
          body.status = patch.status
        }
        if (patch.name) body.name = patch.name
        if (patch.email) body.email = patch.email

        const res = await fetchFirstOk(apiCandidates(`/admin/users/${user.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (res?.ok) {
          apply()
          recordAudit(auditAction, user.email)
          toast.success(auditAction)
          return
        }
        if (res?.status === 404 || res?.status === 405) {
          apply()
          recordAudit(auditAction, user.email)
          toast.message(`${auditAction} (applied locally — endpoint missing)`)
          return
        }
        throw new Error(await readErrorMessage(res!, `Failed (${res?.status}).`))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed.")
      }
    },
    [fetchFirstOk, isLiveData, recordAudit],
  )

  const confirmDelete = useCallback(async () => {
    if (!selectedUser) return
    const user = selectedUser
    setDeleteDialogOpen(false)
    setSelectedUser(null)

    const removeLocal = () =>
      setUsers((prev) => prev.filter((u) => u.id !== user.id))

    if (!isLiveData) {
      removeLocal()
      recordAudit("Deleted user", user.email)
      toast.success("Deleted user (local demo)")
      return
    }

    try {
      const res = await fetchFirstOk(apiCandidates(`/admin/users/${user.id}`), {
        method: "DELETE",
      })
      if (res?.ok || res?.status === 204) {
        removeLocal()
        recordAudit("Deleted user", user.email)
        toast.success("Deleted user")
        return
      }
      if (res?.status === 404 || res?.status === 405) {
        removeLocal()
        recordAudit("Deleted user", user.email)
        toast.message("Deleted locally — endpoint missing")
        return
      }
      throw new Error(await readErrorMessage(res!, `Failed (${res?.status}).`))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.")
    }
  }, [fetchFirstOk, isLiveData, recordAudit, selectedUser])

  const sendInvite = useCallback(async () => {
    const email = inviteEmail.trim()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Enter a valid email address.")
      return
    }
    setInviteOpen(false)

    const addLocal = () => {
      const newUser: User = {
        id: crypto.randomUUID(),
        name: email.split("@")[0] ?? email,
        email,
        role: inviteRole,
        status: "inactive",
        createdAt: new Date().toISOString().slice(0, 10),
        lastLogin: null,
        documentsCount: 0,
        avatar: null,
      }
      setUsers((prev) => [newUser, ...prev])
    }

    try {
      if (isLiveData) {
        const res = await fetchFirstOk(apiCandidates("/admin/users/invite"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role: inviteRole }),
        })
        if (res?.ok) {
          recordAudit("Invited user", email)
          toast.success(`Invitation sent to ${email}`)
          void loadUsers()
          setInviteEmail("")
          return
        }
        if (res && res.status !== 404 && res.status !== 405) {
          throw new Error(await readErrorMessage(res, `Failed (${res.status}).`))
        }
      }
      addLocal()
      recordAudit("Invited user", email)
      toast.message(
        isLiveData
          ? `Invite recorded locally for ${email} (endpoint missing)`
          : `Invite recorded for ${email} (local demo)`,
      )
      setInviteEmail("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invite failed.")
    }
  }, [fetchFirstOk, inviteEmail, inviteRole, isLiveData, loadUsers, recordAudit])

  return (
    <div className="space-y-4">
      {notice ? (
        <Alert className="bg-muted/30">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Demo directory</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      {/* Filters and actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Filters</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={loadUsers}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invite user
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                aria-label="Filter by role"
              >
                <option value="all">All Roles</option>
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as UserStatus | "all")
                }
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Users ({filteredUsers.length})
            {isLiveData ? (
              <Badge variant="outline" className="text-emerald-600">
                Live
              </Badge>
            ) : (
              <Badge variant="outline">Demo</Badge>
            )}
          </CardTitle>
          <CardDescription>Manage user accounts and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSkeleton variant="list" count={5} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground"
                      >
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <button
                            type="button"
                            className="flex items-center gap-3 text-left"
                            onClick={() => setDetailUser(user)}
                          >
                            <Avatar>
                              <AvatarFallback>
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium hover:underline">
                                {user.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {user.email}
                              </div>
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(user.status)}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.documentsCount}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDetailUser(user)}>
                                <Shield className="mr-2 h-4 w-4" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(user)
                                  setEditDialogOpen(true)
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  recordAudit("Sent email", user.email)
                                  toast.success(`Email queued to ${user.email}`)
                                }}
                              >
                                <Mail className="mr-2 h-4 w-4" />
                                Send Email
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.status === "active" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    mutateUser(
                                      user,
                                      { status: "suspended" },
                                      "Suspended user",
                                    )
                                  }
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Suspend User
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    mutateUser(
                                      user,
                                      { status: "active" },
                                      "Activated user",
                                    )
                                  }
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Activate User
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() =>
                                  mutateUser(
                                    user,
                                    {
                                      role:
                                        user.role === "user"
                                          ? "moderator"
                                          : user.role === "moderator"
                                            ? "admin"
                                            : "user",
                                    },
                                    "Changed role",
                                  )
                                }
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                Cycle role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(user)
                                  setDeleteDialogOpen(true)
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RBAC reference matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Role permissions (RBAC)</CardTitle>
          <CardDescription>
            What each role can do across the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {(Object.keys(ROLE_PERMISSIONS) as UserRole[]).map((role) => (
            <div key={role} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-2">
                <Badge variant={getRoleBadgeVariant(role)}>{role}</Badge>
                <span className="text-xs text-muted-foreground">
                  {users.filter((u) => u.role === role).length} users
                </span>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {ROLE_PERMISSIONS[role].map((perm) => (
                  <li key={perm} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {perm}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>
            Administrative actions performed in this session
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No actions yet. Role changes, suspensions, invites and deletes are
              recorded here.
            </p>
          ) : (
            <ul className="space-y-2">
              {auditLog.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                >
                  <span>
                    <span className="font-medium">{entry.actor}</span>{" "}
                    {entry.action.toLowerCase()} —{" "}
                    <span className="text-muted-foreground">{entry.target}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.at).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Detail drawer */}
      <Dialog
        open={detailUser !== null}
        onOpenChange={(open) => !open && setDetailUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User details</DialogTitle>
            <DialogDescription>
              Profile, access, and activity summary
            </DialogDescription>
          </DialogHeader>
          {detailUser && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>{getInitials(detailUser.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-lg font-semibold">{detailUser.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {detailUser.email}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Role</div>
                  <Badge
                    variant={getRoleBadgeVariant(detailUser.role)}
                    className="mt-1"
                  >
                    {detailUser.role}
                  </Badge>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Status</div>
                  <Badge
                    variant={getStatusBadgeVariant(detailUser.status)}
                    className="mt-1"
                  >
                    {detailUser.status}
                  </Badge>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Documents</div>
                  <div className="mt-1 font-medium">
                    {detailUser.documentsCount}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Last login</div>
                  <div className="mt-1 font-medium">
                    {detailUser.lastLogin
                      ? new Date(detailUser.lastLogin).toLocaleDateString()
                      : "—"}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">Effective permissions</div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {ROLE_PERMISSIONS[detailUser.role].map((perm) => (
                    <li key={perm} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailUser(null)}>
              Close
            </Button>
            {detailUser && (
              <Button
                onClick={() => {
                  setSelectedUser(detailUser)
                  setDetailUser(null)
                  setEditDialogOpen(true)
                }}
              >
                Edit user
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <form
              id="edit-user-form"
              className="space-y-4 py-4"
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const name = (form.elements.namedItem("name") as HTMLInputElement)
                  .value
                const email = (
                  form.elements.namedItem("email") as HTMLInputElement
                ).value
                const role = (form.elements.namedItem("role") as HTMLSelectElement)
                  .value as UserRole
                const status = (
                  form.elements.namedItem("status") as HTMLSelectElement
                ).value as UserStatus
                void mutateUser(
                  selectedUser,
                  { name, email, role, status },
                  "Edited user",
                )
                setEditDialogOpen(false)
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={selectedUser.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={selectedUser.email}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  name="role"
                  defaultValue={selectedUser.role}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={selectedUser.status}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-user-form">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>
              Send an invitation email and assign an initial role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendInvite}>Send invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              account for {selectedUser?.name} and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
