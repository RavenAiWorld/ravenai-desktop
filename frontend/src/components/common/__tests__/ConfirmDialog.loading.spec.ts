import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import ConfirmDialog from '../ConfirmDialog.vue'
import BaseDialog from '../BaseDialog.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
enableAutoUnmount(afterEach)

describe('ConfirmDialog pending action', () => {
  it('shows pending feedback and blocks confirmation and every dismissal path until settled', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: { show: true, title: 'Delete', message: 'Delete account?', loading: true, loadingText: 'Deleting...' },
      global: { stubs: { teleport: true } }
    })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons.every(button => button.element.disabled)).toBe(true)
    expect(buttons[1].text()).toBe('Deleting...')
    expect(buttons[1].attributes('aria-busy')).toBe('true')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    wrapper.getComponent(BaseDialog).vm.$emit('close')
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('cancel')).toBeUndefined()

    await wrapper.setProps({ loading: false })
    const confirm = wrapper.findAll('button').find(button => button.text() === 'common.confirm')!
    expect(confirm.element.disabled).toBe(false)
    await confirm.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
