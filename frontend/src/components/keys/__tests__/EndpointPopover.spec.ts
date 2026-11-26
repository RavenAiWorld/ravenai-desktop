import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const copyToClipboard = vi.fn().mockResolvedValue(true)

const messages: Record<string, string> = {
  'keys.endpoints.title': 'API 端点',
  'keys.endpoints.default': '默认',
  'keys.endpoints.openaiFormat': 'OpenAI 格式（带 /v1）',
  'keys.endpoints.anthropicFormat': 'Anthropic 格式（不带 /v1）',
  'keys.endpoints.copyNamed': '复制 {name} 地址',
  'keys.endpoints.copied': '已复制',
  'keys.endpoints.copiedHint': '已复制到剪贴板',
  'keys.endpoints.clickToCopy': '点击可复制此端点',
  'keys.endpoints.speedTest': '测速',
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: { name: string }) => (messages[key] ?? key).replace('{name}', params?.name ?? ''),
  }),
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyToClipboard,
  }),
}))

import EndpointPopover from '../EndpointPopover.vue'

describe('EndpointPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('在自定义地址下显示说明，并将说明关联到复制按钮', () => {
    const wrapper = mount(EndpointPopover, {
      props: {
        apiBaseUrl: 'https://default.example.com/v1',
        customEndpoints: [
          {
            name: '备用线路',
            endpoint: 'https://backup.example.com/v1',
            description: '自定义说明',
          },
        ],
      },
    })

    const row = wrapper.findAll('dd')[2]
    const description = row.get('p')
    expect(description.text()).toBe('自定义说明')
    expect(row.get('button').attributes('aria-describedby').split(' ')).toContain(description.attributes('id'))
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe(wrapper.get('h2').attributes('id'))
  })

  it.each([
    ['https://default.example.com', 'https://default.example.com'],
    ['https://default.example.com/v1///', 'https://default.example.com'],
    ['https://v1', 'https://v1'],
    ['https://default.example.com:8443/relay/v1/', 'https://default.example.com:8443/relay'],
    ['https://default.example.com/v10', 'https://default.example.com/v10'],
  ])('显示并复制每种协议的 Base URL：%s', async (apiBaseUrl, root) => {
    const wrapper = mount(EndpointPopover, {
      props: { apiBaseUrl, customEndpoints: [] },
    })

    expect(wrapper.findAll('dt').map(el => el.text())).toEqual([
      'OpenAI 格式（带 /v1）', 'Anthropic 格式（不带 /v1）',
    ])
    const rows = wrapper.findAll('dd')
    for (const [i, expected] of [root + '/v1', root].entries()) {
      const row = rows[i]
      expect(row.get('code').text()).toBe(expected)
      expect(row.get('a').attributes('href')).toBe('https://www.tcptest.cn/http/' + encodeURIComponent(expected))
      await row.get('button').trigger('click')
      await flushPromises()
      expect(copyToClipboard).toHaveBeenLastCalledWith(expected, '已复制')
      expect(row.text()).toContain('已复制到剪贴板')
      expect(rows[1 - i].text()).not.toContain('已复制到剪贴板')
    }
  })

  it('只调整默认端点的版本路径，不修改查询参数或自定义线路', async () => {
    const custom = { name: '备用', endpoint: 'https://other.example/bridge/v2/?q=a%2Fb&mode=two#custom', description: '备用说明' }
    const wrapper = mount(EndpointPopover, {
      props: { apiBaseUrl: 'https://example.com/gw/v1/?mode=one#base', customEndpoints: [custom] },
    })
    expect(wrapper.findAll('code').map(el => el.text())).toEqual([
      'https://example.com/gw/v1?mode=one#base', 'https://example.com/gw?mode=one#base', custom.endpoint,
    ])
    await wrapper.setProps({ apiBaseUrl: '' })
    expect(wrapper.findAll('dt').map(el => el.text())).toEqual(['备用'])
    expect(wrapper.get('a').attributes('href')).toBe('https://www.tcptest.cn/http/' + encodeURIComponent(custom.endpoint))
    await wrapper.get('code').trigger('click')
    expect(copyToClipboard).toHaveBeenLastCalledWith(custom.endpoint, '已复制')

    await wrapper.setProps({ customEndpoints: [] })
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('只在复制成功后提示，并只标记实际操作的线路', async () => {
    vi.useFakeTimers()
    const endpoint = 'https://example.com/v1'
    const wrapper = mount(EndpointPopover, {
      props: { apiBaseUrl: endpoint, customEndpoints: [{ name: '备用', endpoint, description: '' }] },
    })

    try {
      const rows = wrapper.findAll('dd')
      copyToClipboard.mockResolvedValueOnce(false)
      await rows[0].get('button').trigger('click')
      await flushPromises()
      expect(rows[0].text()).not.toContain('已复制到剪贴板')

      await rows[2].get('button').trigger('click')
      await flushPromises()
      expect(rows[0].text()).not.toContain('已复制到剪贴板')
      expect(rows[2].text()).toContain('已复制到剪贴板')

      await vi.advanceTimersByTimeAsync(1800)
      expect(rows[2].text()).not.toContain('已复制到剪贴板')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })
})
