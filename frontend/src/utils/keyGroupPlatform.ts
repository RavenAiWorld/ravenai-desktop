import type { ApiKey, Group } from '@/types'

type KeyGroupBinding = Pick<ApiKey, 'group_id' | 'group'>

export type KeyGroupOption = {
  value: number | null
  label: string
  description?: string | null
  group?: Group
  disabled: boolean
}

export function normalizeGroupPlatform(platform?: string | null): string | null {
  if (typeof platform !== 'string') return null
  const normalized = platform.trim().toLowerCase()
  return normalized || null
}

const isGroupID = (id: unknown): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0

export const isVisibleKeyGroup = (group: Group) =>
  isGroupID(group.id) && (group.status === 'active' || group.status === 'maintenance')

export const isBindableKeyGroup = (group: Group) =>
  isGroupID(group.id) && group.status === 'active' && normalizeGroupPlatform(group.platform) !== null

export const toKeyGroupOption = (group: Group): KeyGroupOption => ({
  value: group.id,
  label: group.name,
  description: group.description,
  group,
  disabled: !isBindableKeyGroup(group)
})

export function getCurrentKeyGroup(key: KeyGroupBinding, groups: readonly Group[]): Group | undefined {
  if (!isGroupID(key.group_id)) return undefined
  const attached = key.group?.id === key.group_id ? key.group : undefined
  if (attached?.name && normalizeGroupPlatform(attached.platform)) return attached
  return groups.find((group) => group.id === key.group_id) ?? attached
}

/**
 * `null` means unbound; `undefined` means a bound platform cannot be resolved safely.
 */
export function getBoundKeyPlatform(
  apiKey: KeyGroupBinding,
  groups: readonly Group[]
): string | null | undefined {
  if (apiKey.group_id === null) return null
  if (!isGroupID(apiKey.group_id)) return undefined
  const attachedPlatform = apiKey.group?.id === apiKey.group_id
    ? normalizeGroupPlatform(apiKey.group.platform)
    : null
  const listedPlatform = normalizeGroupPlatform(groups.find((group) => group.id === apiKey.group_id)?.platform)
  if (attachedPlatform && listedPlatform && attachedPlatform !== listedPlatform) return undefined
  return listedPlatform ?? attachedPlatform ?? undefined
}

/** Keep authorized active and maintenance groups on the bound platform. */
export function getAllowedGroupsForKey(
  apiKey: KeyGroupBinding,
  groups: readonly Group[]
): Group[] {
  const boundPlatform = getBoundKeyPlatform(apiKey, groups)
  if (boundPlatform === undefined) return []
  return groups.filter((group) =>
    isVisibleKeyGroup(group) && (boundPlatform === null || normalizeGroupPlatform(group.platform) === boundPlatform)
  )
}

export function getKeyGroupOptionsForKey(
  key: KeyGroupBinding,
  groups: readonly Group[],
  noGroupLabel: string
): KeyGroupOption[] {
  const options = getAllowedGroupsForKey(key, groups).map(toKeyGroupOption)
  const currentId = key.group_id ?? null
  if (!options.some((option) => option.value === currentId)) {
    const group = getCurrentKeyGroup(key, groups)
    options.unshift({
      value: currentId,
      label: group?.name || (currentId === null ? noGroupLabel : `#${currentId}`),
      description: group?.description,
      group: group?.name ? group : undefined,
      disabled: true
    })
  }
  return options
}
