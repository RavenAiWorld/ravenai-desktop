export const money = (value?: number | null, digits = 2) => value == null ? '—' : `$${Number(value).toFixed(digits)}`
export const count = (value?: number | null) => value == null ? '—' : new Intl.NumberFormat('zh-CN').format(value)
export const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
export function dateRange(days: number) {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - days + 1)
  const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  return { start_date: localDate(start), end_date: localDate(end), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
}
export function errorMessage(error: unknown) {
  const value = error as { response?: { data?: { message?: string } }; message?: string }
  return value?.response?.data?.message || value?.message || '暂时无法连接服务器，请重试。'
}
