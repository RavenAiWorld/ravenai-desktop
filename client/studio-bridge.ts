import { Channel } from '@tauri-apps/api/core'
import { native } from './native'

type StreamEvent = { kind: 'headers'; status: number; headers: Record<string, string> } | { kind: 'chunk'; data: string } | { kind: 'end' }
export interface StudioInput { path: string; method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }

export function studioRequest(userId: number, input: StudioInput, active: Set<AbortController>): Promise<Response> {
  const id = crypto.randomUUID()
  const controller = new AbortController()
  active.add(controller)
  return new Promise<Response>((resolve, reject) => {
    let stream: ReadableStreamDefaultController<Uint8Array> | undefined
    let settled = false
    let closed = false
    const fail = (error: unknown) => {
      if (closed) return
      closed = true
      const reason = error instanceof Error ? error : new Error(String(error))
      if (settled) stream?.error(reason)
      else reject(reason)
    }
    const abort = () => {
      fail(new DOMException('请求已停止', 'AbortError'))
      void native('studio_cancel', { id }).catch(() => {})
    }
    input.signal?.addEventListener('abort', abort, { once: true })
    controller.signal.addEventListener('abort', abort, { once: true })
    if (input.signal?.aborted) { active.delete(controller); abort(); return }
    const events = new Channel<StreamEvent>()
    events.onmessage = event => {
      if (closed) return
      if (event.kind === 'headers') {
        if (settled) { fail('工作台重复返回响应头'); return }
        settled = true
        if (event.status === 401) window.dispatchEvent(new Event('session-ended'))
        const body = new ReadableStream<Uint8Array>({ start(value) { stream = value }, cancel() { controller.abort() } })
        resolve(new Response([204, 205, 304].includes(event.status) ? null : body, { status: event.status, headers: event.headers }))
      } else if (event.kind === 'chunk') {
        if (!stream) { fail('工作台响应顺序无效'); return }
        try { stream.enqueue(Uint8Array.from(atob(event.data), character => character.charCodeAt(0))) }
        catch (error) { fail(error) }
      } else {
        closed = true
        stream?.close()
      }
    }
    void native('studio_request', { input: { id, userId, path: input.path, method: input.method || 'GET', headers: input.headers || {}, body: input.body || null }, events })
      .catch(async error => {
        fail(error)
        const state = await native<{ authenticated: boolean }>('client_state').catch(() => null)
        if (state && !state.authenticated) window.dispatchEvent(new Event('session-ended'))
      })
      .finally(() => {
        active.delete(controller)
        input.signal?.removeEventListener('abort', abort)
        controller.signal.removeEventListener('abort', abort)
      })
  })
}
