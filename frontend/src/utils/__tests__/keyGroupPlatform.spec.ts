import { describe, expect, it } from 'vitest'
import type { Group } from '@/types'
import { getAllowedGroupsForKey, getBoundKeyPlatform, getKeyGroupOptionsForKey, normalizeGroupPlatform } from '../keyGroupPlatform'

const makeGroup = (id: number, platform: Group['platform'], name = `Group ${id}`): Group =>
  ({ id, name, platform, status: 'active', subscription_type: 'standard' }) as Group

describe('keyGroupPlatform', () => {
  const allGroups: Group[] = [
    makeGroup(1, 'openai', 'Claude-Lookalike OpenAI'),
    makeGroup(2, 'openai', 'OpenAI Backup'),
    makeGroup(3, 'anthropic', 'Claude-Lookalike OpenAI'),
    makeGroup(4, 'deepseek', 'DeepSeek V3'),
    makeGroup(5, 'deepseek', 'DeepSeek R1'),
    makeGroup(6, 'kimi', 'Kimi K2'),
    makeGroup(7, 'zhipu', 'GLM 4.7'),
    makeGroup(8, 'minimax', 'MiniMax M2'),
    makeGroup(9, 'gemini', 'Gemini Pro'),
    makeGroup(10, 'grok', 'Grok 4'),
    makeGroup(11, 'composite', 'ALL'),
  ]

  it('normalizes platform names safely', () => {
    expect(normalizeGroupPlatform(' OpenAI ')).toBe('openai')
    expect(normalizeGroupPlatform('')).toBeNull()
    expect(normalizeGroupPlatform('   ')).toBeNull()
    expect(normalizeGroupPlatform(null)).toBeNull()
    expect(normalizeGroupPlatform(undefined)).toBeNull()
  })

  it('allows all groups for historically unbound keys', () => {
    expect(getBoundKeyPlatform({ group_id: null, group: undefined }, allGroups)).toBeNull()
    expect(getAllowedGroupsForKey({ group_id: null, group: undefined }, allGroups).map((g) => g.id))
      .toEqual(allGroups.map((g) => g.id))
  })

  it('filters strictly by the bound group true platform, never display name or provider bucket', () => {
    // OpenAI -> only OpenAI (not Anthropic even with identical display name, not composite)
    expect(getAllowedGroupsForKey({ group_id: 1, group: allGroups[0] }, allGroups).map((g) => g.id))
      .toEqual([1, 2])

    // Domestic bucket concrete platforms cannot cross-switch
    expect(getAllowedGroupsForKey({ group_id: 4, group: allGroups[3] }, allGroups).map((g) => g.id))
      .toEqual([4, 5])
    expect(getAllowedGroupsForKey({ group_id: 6, group: allGroups[5] }, allGroups).map((g) => g.id))
      .toEqual([6])
    expect(getAllowedGroupsForKey({ group_id: 7, group: allGroups[6] }, allGroups).map((g) => g.id))
      .toEqual([7])
    expect(getAllowedGroupsForKey({ group_id: 8, group: allGroups[7] }, allGroups).map((g) => g.id))
      .toEqual([8])

    // Other bucket concrete platforms cannot cross-switch
    expect(getAllowedGroupsForKey({ group_id: 9, group: allGroups[8] }, allGroups).map((g) => g.id))
      .toEqual([9])
    expect(getAllowedGroupsForKey({ group_id: 11, group: allGroups[10] }, allGroups).map((g) => g.id))
      .toEqual([11])
  })

  it('resolves platform from groups list when apiKey.group is absent or stale', () => {
    expect(getAllowedGroupsForKey({ group_id: 4, group: undefined }, allGroups).map((g) => g.id))
      .toEqual([4, 5])
    // Stale group object (id 3 = anthropic) does not override actual group_id 4 (deepseek)
    expect(getAllowedGroupsForKey({ group_id: 4, group: allGroups[2] }, allGroups).map((g) => g.id))
      .toEqual([4, 5])
  })

  it('resolves platform from apiKey.group when the bound group is no longer in available groups', () => {
    const revokedOpenAI = makeGroup(99, 'openai', 'Revoked OpenAI Exclusive')
    expect(getAllowedGroupsForKey({ group_id: 99, group: revokedOpenAI }, allGroups).map((g) => g.id))
      .toEqual([1, 2])
  })

  it('fails closed when bound group_id has no locally resolvable platform', () => {
    expect(getBoundKeyPlatform({ group_id: 999, group: undefined }, allGroups)).toBeUndefined()
    expect(getAllowedGroupsForKey({ group_id: 999, group: undefined }, allGroups)).toEqual([])
  })

  it('resolves an incomplete attached platform by ID, but does not guess if sources conflict', () => {
    const incomplete = { id: 1 } as Group
    expect(getKeyGroupOptionsForKey({ group_id: 1, group: incomplete }, allGroups, 'No group')
      .map(({ value, disabled }) => ({ value, disabled })))
      .toEqual([{ value: 1, disabled: false }, { value: 2, disabled: false }])
    const conflicting = makeGroup(1, 'anthropic')
    expect(getKeyGroupOptionsForKey({ group_id: 1, group: conflicting }, allGroups, 'No group'))
      .toEqual([expect.objectContaining({ value: 1, disabled: true })])
  })

  it('does not allow a new binding with missing status, a missing option id or an unknown key binding', () => {
    const incomplete = { id: 20, platform: 'openai' } as Group
    const stopped = { ...makeGroup(21, 'openai'), status: 'inactive' } as const
    const maintained = { ...makeGroup(22, 'openai'), status: 'maintenance' } as const
    const missingOptionId = { ...makeGroup(23, 'openai'), id: undefined } as unknown as Group
    const options = getKeyGroupOptionsForKey({ group_id: 1, group: allGroups[0] },
      [...allGroups, incomplete, stopped, maintained, missingOptionId], 'No group')
    expect(options.map(({ value, disabled }) => ({ value, disabled })))
      .toEqual([{ value: 1, disabled: false }, { value: 2, disabled: false }, { value: 22, disabled: true }])
    const missingId = { group_id: undefined } as unknown as Parameters<typeof getAllowedGroupsForKey>[0]
    expect(getAllowedGroupsForKey(missingId, allGroups)).toEqual([])
  })
})
