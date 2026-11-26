export interface HCaptchaRenderOptions {
  sitekey: string
  callback: (token: string) => void
  'expired-callback': () => void
  'chalexpired-callback': () => void
  'error-callback': () => void
  'close-callback'?: () => void
  theme: 'light' | 'dark'
  size: 'normal' | 'compact' | 'invisible'
}

export interface HCaptchaAPI {
  render: (container: HTMLElement, options: HCaptchaRenderOptions) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
  execute: (widgetId: string) => void
}

declare global {
  interface Window {
    hcaptcha?: HCaptchaAPI
    onSub2HCaptchaLoad?: () => void
  }
}

let pending: Promise<void> | null = null

export function loadHCaptcha(): Promise<void> {
  if (window.hcaptcha) return Promise.resolve()
  if (pending) return pending

  pending = new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('script[data-sub2-hcaptcha]')
    const timer = window.setTimeout(() => fail(), 15000)

    function fail(): void {
      window.clearTimeout(timer)
      script?.remove()
      delete window.onSub2HCaptchaLoad
      reject(new Error('Failed to load hCaptcha'))
    }

    window.onSub2HCaptchaLoad = () => {
      window.clearTimeout(timer)
      delete window.onSub2HCaptchaLoad
      if (window.hcaptcha) resolve()
      else fail()
    }

    if (!script) {
      script = document.createElement('script')
      script.dataset.sub2Hcaptcha = ''
      script.src = 'https://js.hcaptcha.com/1/api.js?onload=onSub2HCaptchaLoad&render=explicit&recaptchacompat=off'
      script.async = true
      script.defer = true
      script.addEventListener('error', fail, { once: true })
      document.head.appendChild(script)
    }
  }).finally(() => {
    pending = null
  })
  return pending
}
