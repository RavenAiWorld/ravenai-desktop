import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import type { GroupProfitRates } from '@/api/admin/groups'
import labels from '@/i18n/locales/en/admin/overview'
import GroupProfitCell from '../GroupProfitCell.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { admin: labels } } })
const base: GroupProfitRates = {
  group_id: 1, sell_rate: 0.34, buy_rate: 0.26, margin: 23.5294, profit_per_100: 30.7692,
  target_sell_rate: 0.364, keys: [
    { account_id: 1, name: 'Fast', buy_rate: 0.26, profit_per_100: 30.7692, stale: false },
    { account_id: 2, name: 'Backup', buy_rate: 0.2, profit_per_100: 70, stale: false },
  ],
}

describe('group profit cell', () => {
  it('shows the suggested multiplier without expanding the gross profit details', () => {
    const w = mount(GroupProfitCell, { props: { summary: base }, global: { plugins: [i18n] } })
    expect(w.get('[data-testid="profit-per-100"]').text()).toBe('¥30.77')
    expect(w.get('[data-testid="profit-per-100"]').classes()).toContain('text-amber-700')
    expect(w.get('[data-testid="profit-target-rate"]').text()).toBe('0.364')
    expect(w.get('[data-testid="profit-target-rate"]').element.closest('details')).toBeNull()
    expect(w.text()).toContain('Suggested sell rate')
    expect(w.text()).toContain('23.53%')
    expect(w.get('details').text()).toContain('Group sell rate0.34')
    expect(w.get('details').text()).toContain('Highest AIHUB rate0.26')
    expect(w.get('details').text()).toContain('Backup0.2¥70.00')
    expect(w.text()).not.toMatch(/lifetime profit|fee|reward/i)
  })

  it('distinguishes stale or missing quotes from no AIHUB channel and a fetch failure', async () => {
    const missing = { ...base, buy_rate: null, profit_per_100: null, target_sell_rate: null, margin: null }
    const keys = [
      { ...base.keys[0], profit_per_100: null, stale: true },
      { ...base.keys[1], buy_rate: null, profit_per_100: null, stale: true },
    ]
    const w = mount(GroupProfitCell, { props: { summary: { ...missing, keys } }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('Incomplete AIHUB quotes')
    expect(w.get('details').text()).toContain('0.26Expired quote')
    expect(w.get('details').text()).toContain('BackupNo quote')
    expect(w.find('[data-testid="profit-per-100"]').exists()).toBe(false)
    expect(w.find('[data-testid="profit-target-rate"]').exists()).toBe(false)
    await w.setProps({ summary: { ...missing, keys: [] } })
    expect(w.text()).toBe('No AIHUB channel')
    expect(w.find('details').exists()).toBe(false)
    await w.setProps({ summary: undefined, error: true })
    expect(w.text()).toBe('Unavailable')
  })

  it('marks the exact target as reached and displays a zero-sale loss without a margin', async () => {
    const w = mount(GroupProfitCell, { props: { summary: { ...base, profit_per_100: 40 } }, global: { plugins: [i18n] } })
    expect(w.get('[data-testid="profit-per-100"]').classes()).toContain('text-emerald-700')
    await w.setProps({ summary: { ...base, sell_rate: 0, profit_per_100: -100, margin: null } })
    expect(w.get('[data-testid="profit-per-100"]').text()).toBe('-¥100.00')
    expect(w.text()).not.toContain('%')
    expect(w.get('[data-testid="profit-target-rate"]').text()).toBe('0.364')
  })

  it('shows a pending first quote without estimating it from the sell rate, then updates in place', async () => {
    const pending = { account_id: 163, name: 'S100-Max', buy_rate: null, profit_per_100: null, stale: true, awaiting_first_quote: true }
    const summary: GroupProfitRates = { group_id: 41, sell_rate: 1.7, buy_rate: null, margin: null, profit_per_100: null, target_sell_rate: null, keys: [base.keys[0], pending] }
    const w = mount(GroupProfitCell, { props: { summary }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('Awaiting first AIHUB quote')
    expect(w.get('details').text()).toContain('S100-MaxAwaiting quote')
    expect(w.text()).not.toMatch(/Incomplete AIHUB quotes|No quote/)
    expect(w.find('[data-testid="profit-target-rate"]').exists()).toBe(false)
    await w.setProps({ summary: { ...summary, keys: [{ ...base.keys[0], stale: true }, pending] } })
    expect(w.text()).toContain('Incomplete AIHUB quotes')
    expect(w.text()).toContain('Expired quote')
    await w.setProps({ summary: { ...summary, buy_rate: 1.4499, target_sell_rate: 2.03, keys: [{ ...pending, buy_rate: 1.4499, stale: false, awaiting_first_quote: false }] } })
    expect(w.get('[data-testid="profit-target-rate"]').text()).toBe('2.03')
    expect(w.get('details').text()).toContain('Highest AIHUB rate1.4499')
    expect(w.text()).not.toMatch(/Awaiting|No quote/)
  })
})
