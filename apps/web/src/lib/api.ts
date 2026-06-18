"use client"

import { useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"

import { clearAuthTokens, getAccessToken, refreshAccessToken } from "@/lib/auth"

/** Normalized API base URL (no trailing slash), or "" when unconfigured. */
export function getApiBaseUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  return baseUrl?.replace(/\/+$/, "") ?? ""
}

export class MissingApiBaseUrlError extends Error {
  constructor() {
    super(
      "Missing API base URL. Set NEXT_PUBLIC_BASE_URL (e.g. http://localhost:8000) and restart the dev server.",
    )
    this.name = "MissingApiBaseUrlError"
  }
}

export class NotSignedInError extends Error {
  constructor(message = "You are not signed in.") {
    super(message)
    this.name = "NotSignedInError"
  }
}

type AuthFetchInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>
}

/**
 * Build a versioned + unversioned candidate list for an admin/API path.
 * e.g. apiCandidates("/admin/users") -> ["/api/v1/admin/users", "/admin/users"]
 */
export function apiCandidates(path: string): string[] {
  const clean = path.startsWith("/") ? path : `/${path}`
  return [`/api/v1${clean}`, clean]
}

/**
 * Shared authenticated fetch + helpers for client pages. Mirrors the resilient
 * pattern used by the admin dashboard: attaches the bearer token, retries once
 * after refreshing on 401/403, and redirects to /login when the session is gone.
 */
export function useAuthFetch() {
  const router = useRouter()
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), [])

  const authFetch = useCallback(
    async (urlOrPath: string, init: AuthFetchInit = {}) => {
      const token = getAccessToken()
      if (!token) {
        clearAuthTokens()
        router.push("/login")
        throw new NotSignedInError()
      }

      const url = /^https?:\/\//i.test(urlOrPath)
        ? urlOrPath
        : new URL(urlOrPath, apiBaseUrl || undefined).toString()

      const doFetch = async (accessToken: string) => {
        const headers: Record<string, string> = {
          accept: "application/json",
          ...init.headers,
          Authorization: `Bearer ${accessToken}`,
        }
        return fetch(url, { ...init, headers })
      }

      const res = await doFetch(token)
      if (res.status !== 401 && res.status !== 403) return res

      const nextToken = await refreshAccessToken()
      if (!nextToken) {
        clearAuthTokens()
        router.push("/login")
        throw new NotSignedInError("Session expired. Please sign in again.")
      }

      return doFetch(nextToken)
    },
    [apiBaseUrl, router],
  )

  /**
   * Try each candidate path in order. Returns the first OK response, or the
   * last response (so callers can inspect 404 vs other errors). Skips 404s.
   */
  const fetchFirstOk = useCallback(
    async (
      paths: string[],
      init: AuthFetchInit & { query?: Record<string, string> } = {},
    ) => {
      const { query, ...rest } = init
      let last: Response | null = null
      for (const path of paths) {
        const url = new URL(path, apiBaseUrl || undefined)
        if (query) {
          for (const [key, value] of Object.entries(query)) {
            url.searchParams.set(key, value)
          }
        }
        const res = await authFetch(url.toString(), rest)
        last = res
        if (res.ok) return res
        if (res.status === 404) continue
        return res
      }
      return last
    },
    [apiBaseUrl, authFetch],
  )

  return { apiBaseUrl, authFetch, fetchFirstOk }
}

/** Best-effort error message extraction from a JSON error body. */
export async function readErrorMessage(res: Response, fallback: string) {
  const body = (await res.json().catch(() => ({}))) as {
    detail?: unknown
    message?: unknown
  }
  if (typeof body?.detail === "string") return body.detail
  if (typeof body?.message === "string") return body.message
  return fallback
}

/** Trigger a client-side file download for generated CSV/report content. */
export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/csv;charset=utf-8",
) {
  if (typeof window === "undefined") return
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Serialize an array of flat records to CSV with a fixed column order. */
export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  const escape = (value: unknown) => {
    const str = value == null ? "" : String(value)
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
    return str
  }
  const header = columns.map(escape).join(",")
  const body = rows
    .map((row) => columns.map((col) => escape(row[col])).join(","))
    .join("\n")
  return `${header}\n${body}`
}
