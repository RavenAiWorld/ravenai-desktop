import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCreditShopUrl, openCreditShopPopup } from '../creditShop'

describe('credit shop URL', () => {
  it('uses the configured URL without adding account credentials', () => {
    expect(getCreditShopUrl({
      purchase_subscription_enabled: true,
      purchase_subscription_url: ' https://wzyp.cn/shop/ravenai?category=credit ',
    })).toBe('https://wzyp.cn/shop/ravenai?category=credit')
  })

  it.each([null, undefined])('does not enable an unconfigured shop', (settings) => {
    expect(getCreditShopUrl(settings)).toBe('')
  })

  it('honors the existing purchase switch', () => {
    expect(getCreditShopUrl({
      purchase_subscription_enabled: false,
      purchase_subscription_url: 'https://wzyp.cn/shop/ravenai',
    })).toBe('')
  })

  it.each(['', 'javascript:alert(1)', 'data:text/html,test', '//example.com', '/shop'])(
    'rejects an invalid embed URL %s',
    (url) => {
      expect(getCreditShopUrl({
        purchase_subscription_enabled: true, purchase_subscription_url: url,
      })).toBe('')
    },
  )
})

describe('credit shop popup', () => {
  afterEach(() => vi.restoreAllMocks())

  it('opens a popup synchronously and removes opener and referrer before navigation', () => {
    const link = document.createElement('a')
    const popup = {
      opener: window as Window | null,
      document: { createElement: vi.fn(() => link), body: { append: vi.fn() } },
      close: vi.fn(),
    }
    const click = vi.spyOn(link, 'click').mockImplementation(() => {
      expect(popup.opener).toBeNull()
      expect(link.referrerPolicy).toBe('no-referrer')
    })
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    expect(openCreditShopPopup('https://wzyp.cn/shop/ravenai')).toBe(true)
    expect(open).toHaveBeenCalledWith('', '_blank', expect.stringMatching(/^popup=yes,width=\d+,height=\d+,left=\d+,top=\d+$/))
    expect(link.href).toBe('https://wzyp.cn/shop/ravenai')
    expect(link.rel).toBe('noreferrer noopener')
    expect(click).toHaveBeenCalledOnce()
    expect(popup.close).not.toHaveBeenCalled()
  })

  it('reports a blocked popup', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    expect(openCreditShopPopup('https://wzyp.cn/shop/ravenai')).toBe(false)
  })

  it('handles a browser that refuses window.open', () => {
    vi.spyOn(window, 'open').mockImplementation(() => { throw new Error('Blocked') })
    expect(openCreditShopPopup('https://wzyp.cn/shop/ravenai')).toBe(false)
  })

  it('closes an unused blank popup if navigation cannot be prepared', () => {
    const popup = {
      opener: window,
      document: { createElement: () => { throw new Error('Unavailable') } },
      close: vi.fn(),
    }
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    expect(openCreditShopPopup('https://wzyp.cn/shop/ravenai')).toBe(false)
    expect(popup.close).toHaveBeenCalledOnce()
  })

  it.each(['javascript:alert(1)', '', '//example.com'])('rejects unsafe popup URL %s', (url) => {
    const open = vi.spyOn(window, 'open')
    expect(openCreditShopPopup(url)).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})
