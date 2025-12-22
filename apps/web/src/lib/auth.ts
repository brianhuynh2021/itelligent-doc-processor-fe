export const ACCESS_TOKEN_KEY = "access_token"
export const REFRESH_TOKEN_KEY = "refresh_token"
export const AUTH_CHANGED_EVENT = "auth-changed"
export const AUTH_USER_KEY = "auth_user"

export type AuthTokens = {
  accessToken: string
  refreshToken?: string
}

type JwtPayload = {
  sub?: string
  email?: string
  name?: string
  full_name?: string
  given_name?: string
  family_name?: string
  preferred_username?: string
  username?: string
  role?: string
  roles?: string[] | string
  scope?: string
  scp?: string[] | string
  permissions?: string[] | string
  is_admin?: boolean
  is_superuser?: boolean
  admin?: boolean
}

export type AuthUser = {
  id?: number
  username?: string
  name?: string
  email?: string
  is_admin?: boolean
  is_superuser?: boolean
}

type AuthMeResponse = {
  id: number
  email: string
  username: string
  is_active: boolean
  is_admin?: boolean
  is_superuser?: boolean
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ""
).replace(/\/+$/, "")

function broadcastAuthChange() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  )
  return atob(padded)
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".")
    if (!payload) return null
    const json = decodeBase64Url(payload)
    const data = JSON.parse(json)
    if (!data || typeof data !== "object") return null
    return data as JwtPayload
  } catch {
    return null
  }
}

export function getAccessToken() {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function hasAuthSession() {
  return Boolean(getAccessToken())
}

export function getStoredAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(AUTH_USER_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== "object") return null
    const candidate = data as {
      id?: unknown
      username?: unknown
      name?: unknown
      email?: unknown
      is_admin?: unknown
      is_superuser?: unknown
    }
    const user: AuthUser = {}
    if (typeof candidate.id === "number" && Number.isFinite(candidate.id)) {
      user.id = candidate.id
    }
    if (typeof candidate.username === "string" && candidate.username) {
      user.username = candidate.username
    }
    if (typeof candidate.name === "string" && candidate.name) user.name = candidate.name
    if (typeof candidate.email === "string" && candidate.email) user.email = candidate.email
    if (typeof candidate.is_admin === "boolean") user.is_admin = candidate.is_admin
    if (typeof candidate.is_superuser === "boolean") user.is_superuser = candidate.is_superuser
    return Object.keys(user).length ? user : null
  } catch {
    return null
  }
}

export function getAuthUser(): AuthUser | null {
  const token = getAccessToken()
  if (!token) return null
  const payload = parseJwtPayload(token)
  if (!payload) return null

  const name =
    payload.name ||
    payload.full_name ||
    [payload.given_name, payload.family_name].filter(Boolean).join(" ") ||
    payload.preferred_username ||
    payload.username

  const email = payload.email
  const subject = payload.sub
  const fallbackName =
    name ||
    email ||
    (subject
      ? /^\d+$/.test(subject)
        ? `User #${subject}`
        : subject
      : null)

  const user: AuthUser = {}
  if (fallbackName) user.name = fallbackName
  if (email) user.email = email
  return user
}

export function storeAuthUser(user: AuthUser) {
  if (typeof window === "undefined") return
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
  broadcastAuthChange()
}

export async function refreshAuthUser() {
  const token = getAccessToken()
  if (!token) return null
  if (!API_BASE_URL) return null

  const meUrl = new URL("/api/v1/auth/me", API_BASE_URL).toString()
  const response = await fetch(meUrl, {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) return null

  const data = (await response.json().catch(() => null)) as AuthMeResponse | null
  if (!data?.email && !data?.username) return null

  const user: AuthUser = {}
  user.id = data.id
  user.username = data.username
  if (data.username) user.name = data.username
  if (data.email) user.email = data.email
  if (typeof data.is_admin === "boolean") user.is_admin = data.is_admin
  if (typeof data.is_superuser === "boolean") user.is_superuser = data.is_superuser
  storeAuthUser(user)
  return user
}

export function isAdminSession() {
  const token = getAccessToken()
  if (!token) return false

  const storedUser = getStoredAuthUser()
  if (storedUser?.is_admin || storedUser?.is_superuser) return true

  const payload = parseJwtPayload(token)
  if (!payload) return false

  if (payload.is_admin || payload.is_superuser || payload.admin) return true

  const roleValues = new Set<string>()
  const add = (value: unknown) => {
    if (!value) return
    if (Array.isArray(value)) {
      for (const item of value) add(item)
      return
    }
    if (typeof value === "string") {
      for (const token of value.split(/[,\s]+/).filter(Boolean)) {
        roleValues.add(token.toLowerCase())
      }
    }
  }

  add(payload.role)
  add(payload.roles)
  add(payload.scope)
  add(payload.scp)
  add(payload.permissions)

  const hasAdminClaim =
    roleValues.has("admin") ||
    roleValues.has("administrator") ||
    roleValues.has("superuser") ||
    roleValues.has("root")

  return hasAdminClaim
}

export function storeAuthTokens(tokens: AuthTokens) {
  if (typeof window === "undefined") return
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  }
  broadcastAuthChange()
}

export function clearAuthTokens() {
  if (typeof window === "undefined") return
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
  broadcastAuthChange()
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  if (!API_BASE_URL) return null

  const refreshUrl = new URL("/api/v1/auth/refresh", API_BASE_URL).toString()

  const res = await fetch(refreshUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  }).catch(() => null)

  if (!res?.ok) return null

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const accessToken =
    (typeof data.access_token === "string" && data.access_token) ||
    (typeof data.accessToken === "string" && data.accessToken) ||
    null
  const newRefreshToken =
    (typeof data.refresh_token === "string" && data.refresh_token) ||
    (typeof data.refreshToken === "string" && data.refreshToken) ||
    null

  if (!accessToken) return null

  storeAuthTokens({
    accessToken,
    refreshToken: newRefreshToken ?? refreshToken,
  })

  return accessToken
}
