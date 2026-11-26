import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import LoginAgreementPrompt from '../LoginAgreementPrompt.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function mountPrompt(mode = 'checkbox') {
  return mount(LoginAgreementPrompt, {
    props: {
      accepted: false,
      mode,
      visible: false,
      documents: [
        { id: 'service-terms', title: 'Terms', content_md: 'Terms' },
        { id: 'privacy-policy', title: 'Privacy', content_md: 'Privacy' }
      ]
    },
    global: { stubs: { RouterLink: RouterLinkStub, Icon: true } }
  })
}

describe('LoginAgreementPrompt', () => {
  it('keeps the yellow notice for both unchecked and accepted consent', async () => {
    const wrapper = mountPrompt()
    const checkbox = wrapper.get<HTMLInputElement>('input[type="checkbox"]')
    expect(checkbox.element.checked).toBe(false)
    expect(wrapper.find('.bg-amber-50').exists()).toBe(true)
    expect(wrapper.emitted('accept')).toBeUndefined()
    await checkbox.setValue(true)
    expect(wrapper.emitted('accept')).toHaveLength(1)
    await wrapper.setProps({ accepted: true })
    expect(checkbox.element.checked).toBe(true)
    expect(wrapper.find('.bg-amber-50').exists()).toBe(true)
    await checkbox.setValue(false)
    expect(wrapper.emitted('reject')).toHaveLength(1)
    wrapper.unmount()
  })

  it('preserves separate legal document links without accepting consent', async () => {
    const wrapper = mountPrompt()
    const links = wrapper.findAllComponents(RouterLinkStub)
    expect(links.map((link) => link.props('to'))).toEqual([
      { name: 'LegalDocument', params: { documentId: 'service-terms' } },
      { name: 'LegalDocument', params: { documentId: 'privacy-policy' } }
    ])
    for (const link of links) {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
      await link.trigger('click')
    }
    expect(wrapper.emitted('accept')).toBeUndefined()
    wrapper.unmount()
  })

  it('uses the yellow notice in modal mode and retains the open action', async () => {
    const wrapper = mountPrompt('modal')
    expect(wrapper.find('.bg-amber-50').exists()).toBe(true)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    await wrapper.setProps({ accepted: true })
    expect(wrapper.find('.bg-amber-50').exists()).toBe(false)
    wrapper.unmount()
  })
})
