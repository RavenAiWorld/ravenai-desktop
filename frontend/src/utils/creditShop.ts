import type { PublicSettings } from '@/types'
import { sanitizeUrl } from '@/utils/url'

type CreditShopSettings = Pick<PublicSettings, 'purchase_subscription_enabled' | 'purchase_subscription_url'>

export function getCreditShopUrl(settings: CreditShopSettings | null | undefined): string {
  if (settings?.purchase_subscription_enabled !== true) return ''
  return sanitizeUrl(settings.purchase_subscription_url || '')
}

export function openCreditShopPopup(url: string): boolean {
  const destination = sanitizeUrl(url)
  if (!destination) return false
  const availableWidth = window.screen.availWidth || window.innerWidth
  const availableHeight = window.screen.availHeight || window.innerHeight
  const width = Math.min(1100, Math.max(320, availableWidth - 48))
  const height = Math.min(820, Math.max(480, availableHeight - 80))
  const left = Math.max(0, Math.round((availableWidth - width) / 2))
  const top = Math.max(0, Math.round((availableHeight - height) / 2))
  let popup: Window | null = null
  try {
    popup = window.open('', '_blank', `popup=yes,width=${width},height=${height},left=${left},top=${top}`)
    if (!popup) return false
    // Retain blocked-popup detection, then sever opener access before navigating.
    popup.opener = null
    const link = popup.document.createElement('a')
    link.href = destination
    link.rel = 'noreferrer noopener'
    link.referrerPolicy = 'no-referrer'
    popup.document.body.append(link)
    link.click()
    return true
  } catch {
    popup?.close()
    return false
  }
}
