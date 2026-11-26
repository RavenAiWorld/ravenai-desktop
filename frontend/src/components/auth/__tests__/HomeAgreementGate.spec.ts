import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomeAgreementGate from '../HomeAgreementGate.vue'
import { useAppStore } from '@/stores/app'
import type { PublicSettings } from '@/types'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const key = 'sub2api_login_agreement_consent'
const settings = (revision: string) => ({
  login_agreement_enabled: true,
  login_agreement_mode: 'modal',
  login_agreement_revision: revision,
  login_agreement_updated_at: '2026-10-28',
  login_agreement_documents: [
    { id: 'service-terms', title: '用户协议', content_md: 'terms' },
    { id: 'privacy-policy', title: '隐私政策', content_md: 'privacy' },
  ],
} as PublicSettings)

describe('home agreement gate', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('requires an explicit check and remembers the actual agreement revision', async () => {
    const store = useAppStore()
    store.cachedPublicSettings = settings('revision-one')
    const wrapper = mount(HomeAgreementGate, {
      attachTo: document.body,
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, Icon: true } },
    })
    await nextTick()
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).not.toBeNull()
    expect(dialog.textContent).toContain('用户协议')
    expect(dialog.textContent).toContain('隐私政策')
    const checkbox = dialog.querySelector('input[type="checkbox"]') as HTMLInputElement
    const buttons = dialog.querySelectorAll('button')
    expect(buttons[1].disabled).toBe(true)
    checkbox.click()
    await nextTick()
    expect(buttons[1].disabled).toBe(false)
    buttons[1].click()
    await nextTick()
    expect(JSON.parse(localStorage.getItem(key) || '{}').revision).toBe('revision-one')
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()

    store.cachedPublicSettings = settings('revision-two')
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect((document.body.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false)
    wrapper.unmount()
  })

  it('does not show the modal when the saved revision matches or the feature is disabled', async () => {
    const store = useAppStore()
    store.cachedPublicSettings = settings('revision-one')
    localStorage.setItem(key, JSON.stringify({ revision: 'revision-one' }))
    const wrapper = mount(HomeAgreementGate, {
      attachTo: document.body,
      global: { stubs: { RouterLink: true, Icon: true } },
    })
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    store.cachedPublicSettings = { ...settings('revision-two'), login_agreement_enabled: false }
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })
})
