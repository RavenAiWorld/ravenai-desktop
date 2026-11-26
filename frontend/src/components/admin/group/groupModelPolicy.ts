import type { ModelAllowlist } from '@/types'
import {
  buildModelAllowlistConfig,
  hydrateModelAllowlistState,
  type ModelAllowlistState,
} from '@/views/admin/groupModelAllowlist'

export interface GroupModelPolicyState extends ModelAllowlistState {
  initiallySelected: string[]
  excludedModels: string[]
}

const key = (id: string) => id.trim().toLowerCase()
const publicID = (id: string) => key(id).replace(/^models\//, '')

export function matchesGroupModelPattern(pattern: string, model: string): boolean {
  const escaped = key(pattern).split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${escaped}$`).test(key(model))
}

export function hydrateGroupModelPolicy(
  policy: ModelAllowlist | undefined,
  candidates: string[],
): GroupModelPolicyState {
  const excludedModels = policy?.excluded_models || []
  const state = hydrateModelAllowlistState(policy, [...candidates, ...excludedModels])
  const excludedEntries = new Set(excludedModels.map(key))
  const excludedIDs = new Set(excludedModels.filter(id => !id.includes('*')).map(publicID))
  if (policy?.enabled || policy?.models?.length || excludedModels.length) {
    state.items.forEach(item => {
      item.selected = !excludedEntries.has(key(item.id)) && !excludedIDs.has(publicID(item.id)) && (policy?.models || []).some(
        pattern => matchesGroupModelPattern(pattern, item.id),
      )
    })
  }
  return {
    ...state,
    initiallySelected: state.items.filter(item => item.selected).map(item => item.id),
    excludedModels: [...excludedModels],
  }
}

export function buildGroupModelPolicy(state: GroupModelPolicyState): ModelAllowlist {
  const config = buildModelAllowlistConfig(state)
  const selected = new Set(config.models.map(key))
  const initiallySelected = new Set(state.initiallySelected.map(key))
  const removed = state.items.filter(item => !item.selected && (
    initiallySelected.has(key(item.id)) || config.models.some(pattern => matchesGroupModelPattern(pattern, item.id))
  )).map(item => item.id)
  const excluded = new Map<string, string>()
  for (const id of [...state.excludedModels, ...removed]) {
    if (!selected.has(key(id))) excluded.set(key(id), id)
  }
  return { ...config, ...(excluded.size ? { excluded_models: [...excluded.values()] } : {}) }
}
