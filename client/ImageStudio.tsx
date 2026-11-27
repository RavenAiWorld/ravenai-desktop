import { useLayoutEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { native } from './native'
import { studioRequest, type StudioInput } from './studio-bridge'
import { ErrorMessage, Loading, useNotice } from './ui'

async function verifyPreview(): Promise<boolean> {
  return new Promise(resolve => {
    const frame = document.createElement('iframe')
    frame.hidden = true
    frame.sandbox.add('allow-scripts')
    const finish = (passed: boolean) => {
      clearTimeout(timer)
      window.removeEventListener('message', receive)
      frame.remove()
      resolve(passed)
    }
    const receive = (event: MessageEvent) => {
      if (event.source === frame.contentWindow && event.data?.channel === 'raven-preview-verification') finish(event.origin === 'null' && event.data.isolated === true)
    }
    const timer = setTimeout(() => finish(false), 5000)
    window.addEventListener('message', receive)
    frame.onload = () => frame.contentWindow?.postMessage({ channel: 'raven-replica-preview', html: '<html><body><script>let isolated = false; try { parent.document.title } catch { isolated = true } parent.postMessage({channel: "raven-preview-verification", isolated}, "*")<\/script></body></html>' }, '*')
    frame.src =
      typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent)
        ? 'raven-preview://localhost/preview'
        : 'http://raven-preview.localhost/preview'
    document.body.append(frame)
  })
}

export default function ImageStudio({ userId, active, navigate }: { userId: number; active: boolean; navigate: (page: string) => void }) {
  const [ready, setReady] = useState(false)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const notice = useNotice()
  useLayoutEffect(() => {
    const requests = new Set<AbortController>()
    const bridge = {
      userId,
      request: (input: StudioInput) => studioRequest(userId, input, requests),
      theme: () => document.documentElement.dataset.theme || 'light',
      navigate,
      save: async (name: string, data: string) => {
        try {
          const saved = await native<boolean>('studio_save', { name, data })
          if (saved) notice('作品已保存')
          return saved
        } catch (error) { notice(String(error)); throw error }
      },
      loadPluginCredentials: () =>
        native<Record<string, { apiKey: string; baseUrl: string }>>('studio_plugin_credentials_get', { userId }),
      savePluginCredentials: (credentials: Record<string, { apiKey: string; baseUrl: string }>) =>
        native<void>('studio_plugin_credentials_set', { userId, credentials }),
      ready: (tools: number, width: number, height: number) => {
        setReady(true)
        void native<{ verify_studio?: boolean }>('client_state').then(async state => {
          if (state.verify_studio) await native('studio_ready', { tools, width, height, preview: await verifyPreview() })
        }).catch(() => {})
      },
      failed: (message: string) => { setError(message); setReady(true) },
    }
    ;(window as unknown as { ravenStudio: typeof bridge }).ravenStudio = bridge
    setReady(false)
    setError('')
    return () => {
      for (const request of requests) request.abort()
      delete (window as unknown as { ravenStudio?: typeof bridge }).ravenStudio
    }
  }, [userId, revision, navigate, notice])
  return <section className="embedded-module studio-module" hidden={!active} aria-label="生图平台">
    {!ready && <div className="embed-loading"><Loading label="正在连接创作工作台" /></div>}
    {error && <div className="embed-error"><ErrorMessage error={error} /><button onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />重新连接</button></div>}
    <iframe key={`${userId}-${revision}`} className="studio-frame" src="/assets/studio/index.html" title="Ravenai 生图平台" allow="clipboard-write 'self'" />
  </section>
}
