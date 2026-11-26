import type { SyncUpstreamModelsResult } from '@/api/admin/accounts'

export function modelSyncWarningKey(warnings: SyncUpstreamModelsResult['warnings']) {
  if (warnings?.some(warning => warning.code === 'upstream_model_metadata_incomplete')) {
    return 'admin.accounts.syncUpstreamModelsMetadataIncomplete'
  }
  if (warnings?.some(warning => warning.code === 'upstream_model_metadata_partial')) {
    return 'admin.accounts.syncUpstreamModelsMetadataPartial'
  }
  return undefined
}
