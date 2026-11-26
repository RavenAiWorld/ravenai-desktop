import { invoke } from '@tauri-apps/api/core'
import { useQuery } from '@tanstack/react-query'
import type { ClientState } from './types'

export const native = invoke
export function queryPath(path: string, params: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') query.set(key, String(value))
  return `${path}${query.size ? `?${query}` : ''}`
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  try { return await invoke<T>('api_request', { method, path, body: body ?? null }) }
  catch (error) {
    const state = await invoke<ClientState>('client_state').catch(() => null)
    if (state && !state.authenticated) window.dispatchEvent(new Event('session-ended'))
    throw new Error(typeof error === 'string' ? error : '请求失败，请稍后重试。')
  }
}
export function useApi<T>(path: string, enabled = true) {
  return useQuery<T, Error>({ queryKey: [path], queryFn: () => api<T>(path), enabled, staleTime: 30_000, retry: 1 })
}
export const site = (page: string) => invoke('open_site', { page })
export function money(value: number | null | undefined, precision = 2) {
  return value == null || !Number.isFinite(value) ? '--' : `$${value.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })}`
}
export const number = (value: number | null | undefined) => value == null ? '--' : value.toLocaleString('zh-CN')
export const date = (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '--'
export function csv(rows: unknown[][]): string {
  return rows.map(row => row.map(value => {
    let text = value == null ? '' : String(value)
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }).join(',')).join('\r\n')
}
