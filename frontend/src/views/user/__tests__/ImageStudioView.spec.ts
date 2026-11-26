import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import ImageStudioView from '../ImageStudioView.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: () => 'Image Studio' }) }))
vi.mock('@/components/layout/AppLayout.vue', () => ({
  default: { name: 'AppLayout', props: ['hideHeading', 'fillViewport'], template: '<main><slot /></main>' },
}))

it('opens the studio directly inside the console workspace', () => {
  const wrapper = mount(ImageStudioView)
  const layout = wrapper.getComponent({ name: 'AppLayout' })
  const frame = layout.get('iframe')
  expect(frame.attributes('src')).toBe('/assets/studio/')
  expect(frame.attributes('title')).toBe('Image Studio')
  expect(layout.props('fillViewport')).toBeDefined()
  expect(wrapper.find('a').exists()).toBe(false)
  wrapper.unmount()
})
