import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaHeader from '../PlazaHeader.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function mountHeader(query = '') {
  return mount(PlazaHeader, {
    props: { query, modelCount: 2, groupCount: 1, vendorCount: 1 },
    attachTo: document.body
  })
}

afterEach(() => { document.body.innerHTML = '' })

describe('New API search interaction', () => {
  it('focuses search with Ctrl+K and releases focus on Escape', () => {
    const wrapper = mountHeader()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(document.activeElement).toBe(wrapper.get('input').element)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.activeElement).not.toBe(wrapper.get('input').element)
    wrapper.unmount()
  })

  it('does not move focus behind an open modal', () => {
    const wrapper = mountHeader()
    const modal = document.createElement('div')
    modal.setAttribute('aria-modal', 'true')
    document.body.appendChild(modal)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    expect(document.activeElement).not.toBe(wrapper.get('input').element)
    wrapper.unmount()
  })

  it('clears the bound query from the clear control', async () => {
    const wrapper = mountHeader('gpt-6.1-sol')
    await wrapper.get('.search-clear').trigger('click')
    expect(wrapper.emitted('update:query')).toEqual([['']])
    wrapper.unmount()
  })
})
