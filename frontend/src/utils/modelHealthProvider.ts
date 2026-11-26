import type { ModelHealthProviderModel, ModelHealthProviders } from '@/api/admin/modelHealth'

export function modelHealthProviderHealth(model: ModelHealthProviderModel, source?: Pick<ModelHealthProviders, 'stale' | 'error'>, now = Date.now()): string {
  const evaluated = Date.parse(model.health_evaluated_at ?? '')
  const expires = Date.parse(model.health_expires_at ?? '')
  if (!source || source.stale || source.error || !Number.isFinite(evaluated) || !Number.isFinite(expires) ||
    expires <= now || evaluated > now + 30000 || now - evaluated > 120000 ||
    model.probe_state && model.probe_state !== 'enabled') return 'stale'
  return model.health === 'healthy' || model.health === 'failed' ? model.health : 'unknown'
}

export function modelHealthProviderNotice(error?: string): string {
  if (error === 'provider_auth_required' || error === 'provider_http_401') return 'admin.modelHealth.providerAuthRequired'
  if (error === 'provider_auth_failed') return 'admin.modelHealth.providerAuthFailed'
  if (error === 'provider_access_denied' || error === 'provider_http_403') return 'admin.modelHealth.providerAccessDenied'
  if (error === 'provider_credentials_unavailable') return 'admin.modelHealth.providerCredentialsUnavailable'
  return 'admin.modelHealth.providerStale'
}


/** Exact account id only: S067-Pro-3-Fast is excluded from the health board and rule candidates, not from relay or billing. */
export const MODEL_HEALTH_EXCLUDED_ACCOUNT_IDS: ReadonlySet<number> = new Set([147])

export function isModelHealthExcludedAccount(id: number | null | undefined): boolean {
  return typeof id === 'number' && MODEL_HEALTH_EXCLUDED_ACCOUNT_IDS.has(id)
}

export type ModelHealthGroupProbeStatus = 'ok' | 'abnormal' | 'unknown' | 'source_failed'

export type ModelHealthGroupProbePresentation = {
  status: ModelHealthGroupProbeStatus
  labelKey: 'admin.modelHealth.groupProbeOk' | 'admin.modelHealth.groupProbeAbnormal' | 'admin.modelHealth.groupProbeUnknown' | 'admin.modelHealth.groupProbeSourceFailed'
  titleKey: 'admin.modelHealth.groupProbeOkHint' | 'admin.modelHealth.groupProbeAbnormalHint' | 'admin.modelHealth.groupProbeUnknownHint' | 'admin.modelHealth.groupProbeSourceFailedHint'
  availableRaw: 'true' | 'false' | 'null' | 'missing'
  probeExpiresRaw: string
  feedRaw: 'fresh' | 'stale' | 'error' | 'missing'
}

export function modelHealthGroupProbeAvailableRaw(group?: { available?: boolean | null } | null): ModelHealthGroupProbePresentation['availableRaw'] {
  if (group == null || !Object.prototype.hasOwnProperty.call(group, 'available')) return 'missing'
  if (group.available === true) return 'true'
  if (group.available === false) return 'false'
  return 'null'
}

export function modelHealthGroupProbePresentation(
  groupId: number,
  group: { available?: boolean | null; probe_expires_at?: string } | undefined,
  source?: ModelHealthProviders,
  now = Date.now(),
): ModelHealthGroupProbePresentation {
  const availableRaw = modelHealthGroupProbeAvailableRaw(group)
  const expires = Date.parse(group?.probe_expires_at ?? '')
  const probeExpiresRaw = Number.isFinite(expires) ? new Date(expires).toISOString() : 'missing'
  const feedRaw: ModelHealthGroupProbePresentation['feedRaw'] = !source ? 'missing' : source.error ? 'error' : source.stale ? 'stale' : 'fresh'
  const base = { availableRaw, probeExpiresRaw, feedRaw }
  if (!source || source.stale || source.error) {
    return { status: 'source_failed', labelKey: 'admin.modelHealth.groupProbeSourceFailed', titleKey: 'admin.modelHealth.groupProbeSourceFailedHint', ...base }
  }
  const probeValid = Number.isFinite(expires) && expires > now
  if (groupId > 0 && group && probeValid && group.available === true) {
    return { status: 'ok', labelKey: 'admin.modelHealth.groupProbeOk', titleKey: 'admin.modelHealth.groupProbeOkHint', ...base }
  }
  if (groupId > 0 && group && probeValid && group.available === false) {
    return { status: 'abnormal', labelKey: 'admin.modelHealth.groupProbeAbnormal', titleKey: 'admin.modelHealth.groupProbeAbnormalHint', ...base }
  }
  return { status: 'unknown', labelKey: 'admin.modelHealth.groupProbeUnknown', titleKey: 'admin.modelHealth.groupProbeUnknownHint', ...base }
}
