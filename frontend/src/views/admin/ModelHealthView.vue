<template>
  <AppLayout hide-heading>
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">{{ t('admin.modelHealth.title') }}</h2>
        <div class="flex flex-wrap items-center gap-3">
          <label v-if="!selectedGroupID" class="flex items-center gap-2 text-sm">
            <input type="checkbox" class="h-4 w-4 rounded" :checked="state?.settings.enabled" :disabled="!state || saving" @change="toggleEnabled" />
            {{ t('admin.modelHealth.enabled') }}
          </label>
          <button type="button" class="btn btn-secondary h-10 w-10 !p-0" :title="t('common.refresh')" :aria-label="t('common.refresh')" :disabled="loading || saving" @click="refresh">
            <Icon name="refresh" :class="{ 'animate-spin': loading }" />
          </button>
          <button v-if="selectedGroupID && activeTab !== 'events'" type="button" class="btn btn-primary inline-flex items-center gap-2" :disabled="!state || saving || !canAddRule" @click="editRule()"><Icon name="plus" size="sm" />{{ t('admin.modelHealth.add') }}</button>
        </div>
      </div>
      <p v-if="error || state?.error" role="alert" class="break-words border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{{ error || state?.error }}</p>
      <p v-if="!state && loading" class="py-8 text-sm text-gray-500">{{ t('common.loading') }}</p>
      <template v-if="state">
        <p v-if="groupError" role="status" class="text-xs text-amber-700 dark:text-amber-300">{{ t('admin.modelHealth.groupsUnavailable') }}</p>
        <div v-if="selectedGroupID" class="flex items-center gap-3 border-y border-gray-200 py-3 dark:border-dark-700">
          <button type="button" class="btn btn-secondary h-9 w-9 shrink-0 !p-0" :disabled="saving || descriptionSaving" :title="t('admin.modelHealth.backToGroups')" :aria-label="t('admin.modelHealth.backToGroups')" @click="selectGroup(0)"><Icon name="arrowLeft" size="sm" /></button>
          <label class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span class="text-sm font-medium">{{ t('admin.modelHealth.routingGroup') }}</span>
            <select :value="selectedGroupID" class="input w-full sm:w-60" data-testid="health-routing-group" :disabled="saving || descriptionSaving" @change="selectGroup(Number(($event.target as HTMLSelectElement).value))">
              <option :value="0">{{ t('admin.modelHealth.backToGroups') }}</option>
              <option v-for="group in groups" :key="group.id" :value="group.id">{{ groupOptionLabel(group) }}</option>
            </select>
          </label>
        </div>
        <div v-if="selectedGroupID" class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div v-for="stat in summary" :key="stat.key" :data-testid="stat.testId" class="flex items-center gap-2">
            <span class="text-gray-500">{{ stat.label }}</span>
            <span class="font-semibold tabular-nums" :class="stat.color">{{ stat.value }}</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-dark-700">
          <div class="flex flex-wrap gap-x-4" role="tablist">
            <button v-for="tab in tabs" :key="tab" type="button" role="tab" :aria-selected="activeTab === tab" class="border-b-2 py-3 text-sm font-medium" :class="activeTab === tab ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500'" @click="activeTab = tab">{{ t(`admin.modelHealth.${tab}`) }}</button>
          </div>
          <input v-if="!selectedGroupID" v-model="groupSearch" type="search" class="input mb-2 w-full sm:w-72" :placeholder="t('admin.modelHealth.searchGroups')" :aria-label="t('admin.modelHealth.searchGroups')" />
          <input v-else v-model="search" type="search" class="input mb-2 w-full sm:w-72" :placeholder="t('admin.modelHealth.search')" :aria-label="t('admin.modelHealth.search')" />
        </div>
        <section v-if="!selectedGroupID" :aria-label="t('admin.modelHealth.groups')">
            <div v-if="activeTab === 'overview' && unownedOrphanRules.length" data-testid="unowned-orphan-rules" class="mb-4 rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800/60 dark:bg-amber-900/20">
              <p class="text-sm font-semibold text-amber-800 dark:text-amber-300">{{ t('admin.modelHealth.unownedOrphanRules', { count: unownedOrphanRules.length }) }}</p>
              <p class="mt-1 text-xs text-amber-700 dark:text-amber-300/90">{{ t('admin.modelHealth.unownedOrphanRulesHint') }}</p>
              <ul class="mt-3 divide-y divide-amber-200/70 dark:divide-amber-800/50">
                <li v-for="rule in unownedOrphanRules" :key="rule.id" class="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <div class="min-w-0 flex-1">
                    <p class="break-all font-semibold">{{ rule.model }}</p>
                    <p class="text-xs text-gray-600 dark:text-gray-300">{{ rule.name }} · {{ rule.enabled ? t(`admin.modelHealth.modes.${rule.mode}`) : t('admin.modelHealth.paused') }} · {{ ruleMissingIDs(rule).map(id => `#${id}`).join(', ') }}</p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <button v-if="rule.enabled" type="button" data-testid="disable-orphan-rule" class="btn btn-secondary h-8 px-2.5 text-xs" :disabled="saving" @click="disableRule(rule)">{{ t('admin.modelHealth.disableRule') }}</button>
                    <button type="button" class="btn btn-secondary h-8 w-8 !p-0" :title="t('admin.modelHealth.remove')" :aria-label="`${t('admin.modelHealth.remove')} ${rule.name}`" :disabled="saving" @click="deleteID = rule.id"><Icon name="trash" size="sm" /></button>
                  </div>
                </li>
              </ul>
            </div>
            <div class="hidden grid-cols-[minmax(0,1fr)_8rem_7rem_1.25rem] items-center gap-4 border-b border-gray-200 px-3 pb-2 text-xs text-gray-500 dark:border-dark-700 sm:grid">
              <span>{{ t('admin.modelHealth.routingGroup') }}</span><span>{{ t('admin.modelHealth.channelPlatform') }}</span><span>{{ t(`admin.modelHealth.${directoryMetric}`) }}</span>
            </div>
            <ul class="divide-y divide-gray-200 dark:divide-dark-700">
              <li v-for="row in groupRows" :key="row.group.id">
                <button type="button" :data-testid="`health-group-${row.group.id}`" class="grid w-full grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-x-3 gap-y-1 px-3 py-3 text-left hover:bg-gray-50 focus-visible:outline-primary-500 dark:hover:bg-dark-800 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_1.25rem] sm:gap-x-4" @click="selectGroup(row.group.id)">
                  <span class="min-w-0"><span class="block break-words text-sm font-semibold">{{ groupOptionLabel(row.group) }}</span><span v-if="row.group.description" class="mt-1 block line-clamp-2 break-words text-xs text-gray-500">{{ row.group.description }}</span></span>
                  <span class="col-start-1 row-start-2 text-xs text-gray-500 sm:col-auto sm:row-auto">{{ platformLabel(row.group.platform) }}</span>
                  <span class="col-start-2 row-start-1 text-xs tabular-nums sm:col-auto sm:row-auto"><template v-if="activeTab === 'groups'"><span class="sm:hidden">{{ t('admin.modelHealth.ready') }} </span><strong :class="row.ready ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500'">{{ row.ready }}</strong> / {{ row.total }}</template><template v-else><span class="sm:hidden">{{ t(`admin.modelHealth.${directoryMetric}`) }} </span>{{ activeTab === 'overview' ? row.rules : row.events }}</template></span>
                  <Icon name="chevronRight" size="sm" class="col-start-3 row-start-1 text-gray-400 sm:col-auto sm:row-auto" />
                </button>
              </li>
            </ul>
            <p v-if="!groupRows.length && !(activeTab === 'overview' && unownedOrphanRules.length)" class="py-10 text-center text-sm text-gray-500">{{ t(!directoryLoaded && !groupError ? 'common.loading' : 'admin.modelHealth.noGroups') }}</p>
        </section>
        <template v-else-if="activeTab === 'groups' && scopedState">
            <div v-if="directoryGroup" class="border-b border-gray-200 pb-3 dark:border-dark-700">
              <form v-if="editingDescription" class="max-w-2xl space-y-2" @submit.prevent="saveDescription">
                <label class="block text-xs text-gray-500">{{ t('admin.modelHealth.groupDescription') }}<textarea v-model="descriptionDraft" class="input mt-1 w-full" rows="2" data-testid="health-group-description" :disabled="descriptionSaving" /></label>
                <p v-if="descriptionError" role="alert" class="text-sm text-red-600">{{ descriptionError }}</p>
                <div class="flex gap-2"><button type="submit" class="btn btn-primary" :disabled="descriptionSaving">{{ t(descriptionSaving ? 'common.saving' : 'common.save') }}</button><button type="button" class="btn btn-secondary" :disabled="descriptionSaving" @click="editingDescription = false">{{ t('common.cancel') }}</button></div>
              </form>
              <div v-else class="flex items-start gap-2"><div class="min-w-0"><p class="text-xs text-gray-500">{{ t('admin.modelHealth.groupDescription') }}</p><p class="mt-1 whitespace-pre-wrap break-words text-sm">{{ directoryGroup.description || t('admin.modelHealth.noDescription') }}</p></div><button type="button" class="btn btn-secondary h-8 w-8 shrink-0 !p-0" :aria-label="t('admin.modelHealth.editDescription')" :title="t('admin.modelHealth.editDescription')" @click="editDescription"><Icon name="edit" size="sm" /></button></div>
            </div>
            <ModelHealthChannels :key="selectedGroupID" :state="scopedState" :search="search" :provider-id="search && search === hallProvider ? hallProviderID : 0" :saving="saving" :loading="loading" :range="metricsRange" :pending-range="pendingRange" @change-range="load" @edit="editRule" @probe="probe" @bind-provider="bindProvider" @retire="retiring = $event" />
        </template>
        <template v-else-if="activeTab === 'overview'">
          <p v-if="sharedLegacyCount" role="status" class="border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-300">{{ t('admin.modelHealth.sharedLegacyCount', { count: sharedLegacyCount }) }}</p>
          <div v-if="staleProviderBindings.length" role="status" data-testid="stale-provider-bindings" class="flex flex-wrap items-center justify-between gap-2 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <span>{{ t('admin.modelHealth.staleProviderBindings', { ids: staleProviderBindings.map(([id]) => `#${id}`).join(', ') }) }}</span>
            <button type="button" class="btn btn-secondary h-8 text-xs" data-testid="clear-stale-bindings" :disabled="saving" @click="clearStaleBindings">{{ t('admin.modelHealth.clearStaleBindings') }}</button>
          </div>
          <div class="overflow-x-auto">
            <table class="block w-full text-left text-sm md:table md:min-w-[780px]">
              <thead class="hidden border-b border-gray-200 text-xs text-gray-500 dark:border-dark-700 md:table-header-group">
                <tr><th class="px-2 py-3">{{ t('admin.modelHealth.model') }}</th><th class="px-2 py-3">{{ t('admin.modelHealth.primary') }}</th><th class="px-2 py-3">{{ t('admin.modelHealth.backups') }}</th><th class="px-2 py-3">{{ t('admin.modelHealth.route') }}</th><th class="px-2 py-3">{{ t('admin.modelHealth.monitoring') }}</th><th class="w-32 px-2 py-3" /></tr>
              </thead>
              <tbody class="block divide-y divide-gray-100 dark:divide-dark-700 md:table-row-group">
                <tr v-for="rule in filteredRules" :key="rule.id" class="grid grid-cols-2 gap-x-3 py-3 md:table-row md:py-0" :class="selectedID === rule.id ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''">
                  <td class="col-span-2 min-w-0 px-2 py-2 md:max-w-60 md:py-4">
                    <button type="button" class="break-all text-left font-semibold text-primary-600" @click="selectedID = rule.id">{{ rule.model }}</button>
                    <p class="mt-1 break-words text-xs text-gray-500">{{ rule.name }} · {{ rule.enabled ? t(`admin.modelHealth.modes.${rule.mode}`) : t('admin.modelHealth.paused') }}</p>
                    <p class="mt-1 break-words text-xs text-gray-500">{{ ruleGroupLabel(rule) }}</p>
                    <p v-if="ruleMissingIDs(rule).length" data-testid="missing-channel-badge" class="mt-1 text-xs text-amber-600">{{ t('admin.modelHealth.missingChannelWarning') }}</p>
                    <p v-if="runtime(rule.id)?.fresh === false && observation(rule.id, rule.primary_id)?.checked_at" class="mt-1 text-xs text-amber-600">{{ t('admin.modelHealth.stale') }}</p>
                  </td>
                  <td class="order-2 min-w-0 px-2 py-2 md:order-none md:max-w-48 md:py-4">
                    <p class="mb-1 text-xs text-gray-500 md:hidden">{{ t('admin.modelHealth.primary') }}</p>
                    <p class="break-words">{{ accountName(rule.primary_id) }}</p>
                    <p class="mt-0.5 text-xs" :class="modelCardColor(observation(rule.id, rule.primary_id))" data-testid="primary-model-card">
                      {{ modelCardLabel(observation(rule.id, rule.primary_id)) }}<span v-if="observation(rule.id, rule.primary_id)?.provider_model_at" class="ml-1 text-gray-400">· {{ formatTime(observation(rule.id, rule.primary_id)?.provider_model_at) }}</span>
                    </p>
                    <p class="text-xs" :class="localOutcomeColor(observation(rule.id, rule.primary_id))" data-testid="primary-local-evidence">{{ localOutcomeLabel(observation(rule.id, rule.primary_id)) }}</p>
                    <p v-for="(adv, idx) in obsAdvisories(observation(rule.id, rule.primary_id))" :key="`${adv.id}-${adv.window}-${idx}`" class="text-xs text-amber-600" data-testid="primary-upstream-advisory">{{ advisoryLabel(adv) }}</p>
                  </td>
                  <td class="order-2 min-w-0 px-2 py-2 md:order-none md:max-w-48 md:py-4"><p class="mb-1 text-xs text-gray-500 md:hidden">{{ t('admin.modelHealth.backups') }}</p><p v-for="id in rule.backup_ids" :key="id" class="break-words"><span class="mr-1.5 inline-block h-2 w-2 rounded-full" :class="observation(rule.id, id)?.status === 'failed' ? 'bg-red-500' : obsAdvisories(observation(rule.id, id)).length ? 'bg-amber-500' : observation(rule.id, id)?.status === 'healthy' ? 'bg-emerald-500' : 'bg-gray-400'" />{{ roleLabel(rule, id) }} · {{ accountName(id) }}</p></td>
                  <td class="order-1 col-span-2 min-w-0 px-2 py-2 md:order-none md:max-w-60 md:py-4">
                    <p class="font-medium" :class="runtime(rule.id)?.route === 'backup' ? 'text-amber-600' : ''">{{ routeLabel(rule) }}</p>
                    <p class="mt-1 break-words text-xs text-gray-500">{{ reasonLabel(runtime(rule.id)?.reason) }}</p>
                    <p v-if="runtime(rule.id)?.apply_status === 'partial' || runtime(rule.id)?.apply_status === 'pending'" data-testid="rule-apply-status" class="mt-1 text-xs text-amber-600">{{ t(runtime(rule.id)?.apply_status === 'partial' ? 'admin.modelHealth.applyPartial' : 'admin.modelHealth.applyPending') }}</p>
                    <p v-if="runtime(rule.id)?.error" class="mt-1 break-words text-xs text-red-600">{{ runtime(rule.id)?.error }}</p>
                  </td>
                  <td class="order-3 min-w-0 px-2 py-2 text-xs md:order-none md:py-4"><p class="mb-1 text-gray-500 md:hidden">{{ t('admin.modelHealth.monitoring') }}</p><span>{{ t('admin.modelHealth.passive') }}</span></td>
                  <td class="order-3 px-2 py-2 md:order-none md:py-4"><div class="flex justify-end gap-1">
                    <button v-if="ruleMissingIDs(rule).length && rule.enabled" type="button" data-testid="disable-orphan-rule" class="btn btn-secondary h-9 px-2 text-xs" :disabled="saving" @click="disableRule(rule)">{{ t('admin.modelHealth.disableRule') }}</button>
                    <button type="button" class="btn btn-secondary h-9 w-9 !p-0" :title="t('admin.modelHealth.probe')" :aria-label="t('admin.modelHealth.probe')" :disabled="saving" @click="probe(rule.id)"><Icon name="refresh" size="sm" /></button>
                    <button type="button" class="btn btn-secondary h-9 w-9 !p-0" :title="t('admin.modelHealth.edit')" :aria-label="t('admin.modelHealth.edit')" @click="editRule(rule)"><Icon name="edit" size="sm" /></button>
                    <button type="button" class="btn btn-secondary h-9 w-9 !p-0" :title="t('admin.modelHealth.remove')" :aria-label="t('admin.modelHealth.remove')" @click="deleteID = rule.id"><Icon name="trash" size="sm" /></button>
                  </div></td>
                </tr>
              </tbody>
            </table>
            <p v-if="!filteredRules.length && !unmanagedModels.length" class="py-10 text-center text-sm text-gray-500">{{ t('admin.modelHealth.empty') }}</p>
          </div>
          <details v-if="unmanagedModels.length" class="border-t border-gray-200 pt-4 dark:border-dark-700" :open="!filteredRules.length">
            <summary class="cursor-pointer text-sm font-semibold">{{ t('admin.modelHealth.unmanagedModels', { count: unmanagedModels.length }) }}</summary>
            <ul class="mt-2 max-h-80 divide-y divide-gray-100 overflow-auto dark:divide-dark-700">
              <li v-for="item in unmanagedModels" :key="item.model" class="flex min-w-0 flex-wrap items-center justify-between gap-2 px-2 py-2.5 text-sm">
                <div class="min-w-0 flex-1">
                  <p class="break-all font-medium">{{ item.model }}</p>
                  <p class="mt-1 break-words text-xs text-gray-500">{{ item.accounts.map(accountName).join(' / ') }}</p>
                </div>
                <button v-if="item.ruleEligible" type="button" class="btn btn-secondary h-9 w-9 shrink-0 !p-0" :title="t('admin.modelHealth.add')" :aria-label="`${t('admin.modelHealth.add')} ${item.model}`" :disabled="saving" @click="editRule(undefined, item.model)"><Icon name="plus" size="sm" /></button>
              </li>
            </ul>
          </details>
          <section v-if="selectedRule" class="border-t border-gray-200 pt-5 dark:border-dark-700">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 class="break-all text-sm font-semibold">{{ t('admin.modelHealth.detail') }} · {{ selectedRule.model }}</h3>
              <p class="text-xs text-gray-500">{{ t('admin.modelHealth.passive') }}</p>
            </div>
            <div class="overflow-x-auto">
              <table class="block w-full text-left text-sm md:table md:min-w-[680px]">
                <thead class="hidden border-b border-gray-200 text-xs text-gray-500 dark:border-dark-700 md:table-header-group"><tr><th class="py-3 pr-3">{{ t('admin.modelHealth.channel') }}</th><th class="p-3">{{ t('admin.modelHealth.result') }}</th><th class="p-3">{{ t('admin.modelHealth.support') }}</th><th class="p-3">{{ t('admin.modelHealth.lastUpdated') }}</th></tr></thead>
                <tbody class="block md:table-row-group">
                  <template v-for="id in [selectedRule.primary_id, ...selectedRule.backup_ids]" :key="id">
                    <tr class="grid grid-cols-2 gap-x-3 border-b border-gray-100 py-3 dark:border-dark-700 md:table-row md:py-0">
                      <td class="col-span-2 min-w-0 py-2 pr-3 md:max-w-64 md:py-3"><p class="break-words font-medium">{{ accountName(id) }} <span class="text-gray-400">#{{ id }}</span></p><p class="mt-1 text-xs text-gray-500">{{ roleLabel(selectedRule, id) }} · {{ t(account(id)?.ready ? 'admin.modelHealth.ready' : 'admin.modelHealth.unavailable') }}</p></td>
                      <td class="min-w-0 py-2 md:p-3">
                        <p class="mb-1 text-xs text-gray-500 md:hidden">{{ t('admin.modelHealth.result') }}</p>
                        <span :class="modelCardColor(observation(selectedRule.id, id))">{{ modelCardLabel(observation(selectedRule.id, id)) }}</span>
                        <span v-if="observation(selectedRule.id, id)?.provider_model_at" class="ml-1 text-xs text-gray-400">· {{ formatTime(observation(selectedRule.id, id)?.provider_model_at) }}</span>
                        <p v-if="observation(selectedRule.id, id)?.traffic" class="mt-1 text-xs text-gray-500">{{ trafficDetails(observation(selectedRule.id, id)) }}</p>
                        <p class="text-xs" :class="localOutcomeColor(observation(selectedRule.id, id))">{{ localOutcomeLabel(observation(selectedRule.id, id)) }}</p>
                        <p v-for="(adv, idx) in obsAdvisories(observation(selectedRule.id, id))" :key="`${adv.id}-${adv.window}-${idx}`" class="text-xs text-amber-600">{{ advisoryLabel(adv) }}</p>
                      </td>
                      <td class="min-w-0 py-2 md:p-3"><p class="mb-1 text-xs text-gray-500 md:hidden">{{ t('admin.modelHealth.support') }}</p>{{ t(accountInRule(id, selectedRule)?.models[selectedRule.model] ? 'admin.modelHealth.serving' : 'admin.modelHealth.blocked') }}</td>
                      <td class="col-span-2 py-2 text-xs tabular-nums md:p-3"><p class="mb-1 text-gray-500 md:hidden">{{ t('admin.modelHealth.lastUpdated') }}</p>{{ formatTime(observation(selectedRule.id, id)?.checked_at) }}</td>
                    </tr>
                    <tr v-if="observation(selectedRule.id, id)?.error" class="block md:table-row"><td colspan="4" class="block break-all pb-3 pt-2 text-xs text-red-600 md:table-cell">{{ observationError(observation(selectedRule.id, id)?.error) }}</td></tr>
                  </template>
                </tbody>
              </table>
            </div>
            <p class="mt-3 text-xs text-gray-500">{{ t('admin.modelHealth.switchedAt') }}: {{ formatTime(runtime(selectedRule.id)?.switched_at) }}</p>
          </section>
        </template>
        <section v-else>
          <div class="mb-3 flex flex-wrap items-center gap-3">
            <select v-model="eventRule" class="input w-full sm:w-56" :aria-label="t('admin.modelHealth.rules')"><option value="">{{ t('admin.modelHealth.allRules') }}</option><option v-for="[id, name] in eventRuleOptions" :key="id" :value="id">{{ name }}</option></select>
            <select v-model="eventType" class="input w-full sm:w-44" :aria-label="t('admin.modelHealth.eventType')"><option value="">{{ t('admin.modelHealth.allTypes') }}</option><option v-for="type in ['probe', 'switch', 'config']" :key="type" :value="type">{{ t(`admin.modelHealth.types.${type}`) }}</option></select>
            <button type="button" class="btn btn-secondary ml-auto h-10 w-10 !p-0" :title="t('admin.modelHealth.export')" :aria-label="t('admin.modelHealth.export')" @click="exportEvents"><Icon name="download" /></button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[680px] text-left text-sm">
              <thead class="border-b border-gray-200 text-xs text-gray-500 dark:border-dark-700"><tr><th class="py-3 pr-3">{{ t('admin.modelHealth.time') }}</th><th class="p-3">{{ t('admin.modelHealth.eventType') }}</th><th class="p-3">{{ t('admin.modelHealth.channel') }}</th><th class="p-3">{{ t('admin.modelHealth.result') }}</th><th class="p-3">{{ t('admin.modelHealth.message') }}</th></tr></thead>
              <tbody class="divide-y divide-gray-100 dark:divide-dark-700"><tr v-for="(event, index) in filteredEvents" :key="`${event.at}-${index}`">
                <td class="whitespace-nowrap py-3 pr-3 text-xs tabular-nums">{{ formatTime(event.at) }}</td><td class="p-3 text-xs">{{ t(`admin.modelHealth.types.${event.type}`) }}<p class="mt-1 text-gray-500">{{ eventName(event) }}</p></td><td class="max-w-48 break-words p-3">{{ event.account_id ? accountName(event.account_id) : '-' }}</td><td class="p-3 text-xs" :class="healthColor(event.status)">{{ healthLabel(event.status) }}<p v-if="event.latency_ms" class="mt-1 text-gray-500">{{ event.latency_ms }} ms</p></td><td class="max-w-lg break-words p-3 text-xs">{{ eventMessage(event) }}</td>
              </tr></tbody>
            </table>
            <p v-if="!filteredEvents.length" class="py-8 text-center text-sm text-gray-500">{{ t('admin.modelHealth.noEvents') }}</p>
          </div>
        </section>
      </template>
    </div>
    <Teleport to="body">
      <div v-if="draft" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" @click.self="closeEditor">
        <form role="dialog" aria-modal="true" :aria-label="t('admin.modelHealth.edit')" class="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 text-gray-900 shadow-xl dark:bg-dark-900 dark:text-white" @submit.prevent="saveRule">
          <div class="mb-5 flex items-center justify-between gap-3"><h3 class="text-base font-semibold">{{ t(editingID ? 'admin.modelHealth.edit' : 'admin.modelHealth.add') }}</h3><button type="button" class="h-9 w-9 shrink-0" :title="t('common.close')" :aria-label="t('common.close')" @click="closeEditor"><Icon name="x" /></button></div>
          <p v-if="editorError" role="alert" class="mb-4 break-words text-sm text-red-600">{{ editorError }}</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="sm:col-span-2"><span class="mb-1.5 block text-sm">{{ t('admin.modelHealth.routingGroup') }}</span>
              <input :value="groupName(selectedGroupID)" readonly class="input w-full" data-testid="health-rule-group" />
            </label>
            <label><span class="mb-1.5 block text-sm">{{ t('admin.modelHealth.name') }}</span><input v-model="draft.name" class="input w-full" maxlength="160" required /></label>
            <label><span class="mb-1.5 block text-sm">{{ t('admin.modelHealth.model') }}</span><input v-model="draft.model" class="input w-full" list="health-models" maxlength="160" required /></label>
            <label class="sm:col-span-2"><span class="mb-1.5 block text-sm">{{ t('admin.modelHealth.upstreamModel') }}</span><input v-model="draft.upstream_model" class="input w-full" list="health-upstream-models" maxlength="160" /></label>
            <label>
              <span class="mb-1.5 block text-sm">{{ t('admin.modelHealth.primary') }}</span>
              <select :value="draft.primary_id" class="input w-full" data-testid="health-draft-primary" required @change="changeDraftPrimary">
                <option :value="0" disabled>{{ t('admin.modelHealth.choose') }}</option>
                <option v-if="draft.primary_id && isMissingAccount(draft.primary_id)" :value="draft.primary_id" disabled>{{ t('admin.modelHealth.missing') }} #{{ draft.primary_id }}</option>
                <option v-for="item in draftAccounts" :key="item.id" :value="item.id" :disabled="item.id !== draft.primary_id && !!supplyIssue(item.id)">{{ item.name }} #{{ item.id }}{{ supplyIssue(item.id) ? ' · ' + t(supplyIssue(item.id)!) : '' }}</option>
              </select>
            </label>
            <label><span class="mb-1.5 block text-sm">{{ t('admin.modelHealth.mode') }}</span><select v-model="draft.mode" class="input w-full"><option v-for="mode in modes" :key="mode" :value="mode">{{ t(`admin.modelHealth.modes.${mode}`) }}</option></select></label>
            <fieldset class="sm:col-span-2">
              <legend class="mb-2 text-sm">{{ t('admin.modelHealth.backups') }} <span class="text-xs text-gray-500">({{ draft.backup_ids.length }} / 32)</span></legend>
              <ol class="divide-y divide-gray-100 border-y border-gray-200 dark:divide-dark-700 dark:border-dark-700" data-testid="backup-chain">
                <li v-for="(id, index) in draft.backup_ids" :key="id" :data-account-id="id" class="flex min-h-11 items-center gap-2 py-2 text-sm">
                  <span class="min-w-0 flex-1 break-words"><span class="text-gray-500">{{ t('admin.modelHealth.backupNumber', { number: index + 1 }) }}</span> · {{ accountName(id) }} #{{ id }}<span v-if="supplyIssue(id)" class="block text-xs text-amber-700 dark:text-amber-300">{{ t(supplyIssue(id)!) }}</span></span>
                  <button type="button" class="h-9 w-9 shrink-0 rounded hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-dark-700" :disabled="index === 0" :title="t('admin.modelHealth.moveUp')" :aria-label="`${t('admin.modelHealth.moveUp')} #${id}`" @click="moveBackup(index, -1)"><Icon name="arrowUp" size="sm" /></button>
                  <button type="button" class="h-9 w-9 shrink-0 rounded hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-dark-700" :disabled="index === draft.backup_ids.length - 1" :title="t('admin.modelHealth.moveDown')" :aria-label="`${t('admin.modelHealth.moveDown')} #${id}`" @click="moveBackup(index, 1)"><Icon name="arrowDown" size="sm" /></button>
                  <button type="button" class="h-9 w-9 shrink-0 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700" :title="t('common.remove')" :aria-label="`${t('common.remove')} #${id}`" @click="draft.backup_ids.splice(index, 1)"><Icon name="x" size="sm" /></button>
                </li>
              </ol>
              <select class="input mt-3 w-full" :aria-label="t('admin.modelHealth.addBackup')" data-testid="add-backup" :disabled="!draft.primary_id || draft.backup_ids.length >= 32" @change="addBackup">
                <option value="">{{ t('admin.modelHealth.addBackup') }}</option>
                <option v-for="item in backupCandidates" :key="item.id" :value="item.id">{{ item.name }} #{{ item.id }}</option>
              </select>
              <p class="mt-1.5 text-xs text-gray-500">{{ t('admin.modelHealth.maxBackups') }}</p>
            </fieldset>
            <label v-for="field in numericFields" :key="field.key"><span class="mb-1.5 block text-sm">{{ t(`admin.modelHealth.${field.label}`) }}</span><input v-model.number="draft[field.key]" type="number" class="input w-full" :min="field.min" :max="field.max" step="1" required /></label>
            <fieldset v-if="draft.header_policy" class="border-t border-gray-200 pt-4 dark:border-dark-700 sm:col-span-2">
              <label class="flex items-center gap-2 text-sm"><input v-model="draft.header_policy.enabled" type="checkbox" class="h-4 w-4 rounded" data-testid="header-policy-enabled" />{{ t('admin.modelHealth.headerPolicy') }}</label>
              <div v-if="draft.header_policy.enabled" class="mt-4 grid gap-4 sm:grid-cols-3">
                <label><span class="mb-1.5 block text-xs">{{ t('admin.modelHealth.headerWaitSeconds') }}</span><input v-model.number="draft.header_policy.wait_seconds" type="number" min="1" max="600" step="1" required class="input w-full" /></label>
                <label><span class="mb-1.5 block text-xs">{{ t('admin.modelHealth.headerRatePercent') }}</span><input v-model.number="draft.header_policy.rate_percent" type="number" min="0.01" max="100" step="0.01" required class="input w-full" /></label>
                <label><span class="mb-1.5 block text-xs">{{ t('admin.modelHealth.headerMinimum') }}</span><input v-model.number="draft.header_policy.min_samples" type="number" min="1" max="100000" step="1" required class="input w-full" /></label>
                <div class="flex flex-wrap gap-4 text-sm sm:col-span-3"><label v-for="minutes in [5, 60]" :key="minutes" class="flex items-center gap-2"><input v-model="draft.header_policy.window_minutes" type="checkbox" :value="minutes" class="h-4 w-4 rounded" />{{ minutes === 60 ? '1h' : '5m' }}</label></div>
              </div>
            </fieldset>
          </div>
          <div class="mt-5 flex flex-wrap items-center justify-between gap-3"><label class="flex items-center gap-2 text-sm"><input v-model="draft.enabled" type="checkbox" class="h-4 w-4 rounded" />{{ t('admin.modelHealth.ruleEnabled') }}</label><div class="flex gap-2"><button type="button" class="btn btn-secondary" :disabled="saving" @click="closeEditor">{{ t('common.cancel') }}</button><button type="submit" class="btn btn-primary" :disabled="saving || !draft.primary_id || (draft.mode === 'backup' && !draft.backup_ids.length)">{{ t(saving ? 'common.saving' : 'common.save') }}</button></div></div>
        </form>
      </div>
      <div v-if="deleteID" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="deleteID = ''">
        <div role="dialog" aria-modal="true" :aria-label="t('admin.modelHealth.remove')" class="w-full max-w-sm rounded-lg bg-white p-5 dark:bg-dark-900"><h3 class="text-base font-semibold">{{ t('admin.modelHealth.remove') }}</h3><p class="mt-3 text-sm text-gray-500">{{ t('admin.modelHealth.removeConfirm') }}</p><div class="mt-5 flex justify-end gap-2"><button type="button" class="btn btn-secondary" @click="deleteID = ''">{{ t('common.cancel') }}</button><button type="button" class="btn btn-danger" :disabled="saving" @click="removeRule">{{ t('common.delete') }}</button></div></div>
      </div>
    </Teleport>
    <SupplierRetireDialog :account="retiring" @close="retiring = null" @retired="handleRetired" />
    <datalist id="health-models"><option v-for="model in models" :key="model" :value="model" /></datalist>
    <datalist id="health-upstream-models"><option v-for="model in upstreamModels" :key="model" :value="model" /></datalist>
  </AppLayout>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import SupplierRetireDialog from '@/components/admin/SupplierRetireDialog.vue'
import type { ModelHealthAccount, ModelHealthEvent } from '@/api/admin/modelHealth'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import ModelHealthChannels from '@/components/admin/ModelHealthChannels.vue'
import { getModelHealth, probeModelHealth, saveModelHealth, type ModelHealthMetricsRange, type ModelHealthObservation, type ModelHealthProviderAdvisory, type ModelHealthRule, type ModelHealthSettings, type ModelHealthState } from '@/api/admin/modelHealth'
import { getAllIncludingInactive, update as updateGroup } from '@/api/admin/groups'
import type { AdminGroup } from '@/types'
import { isModelHealthExcludedAccount } from '@/utils/modelHealthProvider'
import { supplierPlatformLabels } from '@/utils/supplierHall'
import { useAppStore } from '@/stores/app'

const { t, te } = useI18n()
const app = useAppStore()
const route = useRoute()
const router = useRouter()
const queryID = (raw: unknown) => typeof raw === 'string' && Number.isSafeInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : 0
const hallProvider = typeof route.query.provider === 'string' ? route.query.provider : ''
const hallProviderID = queryID(route.query.provider_id)
const selectedGroupID = ref(queryID(route.query.group))
type RoutingGroup = Pick<AdminGroup, 'id' | 'name'> & Partial<Pick<AdminGroup, 'platform' | 'status' | 'description'>>
const groupDirectory = ref<RoutingGroup[]>([])
const groupError = ref(false), directoryLoaded = ref(false), groupSearch = ref(hallProvider)
const editingDescription = ref(false), descriptionSaving = ref(false), descriptionDraft = ref(''), descriptionError = ref('')
const directoryGroup = computed(() => groupDirectory.value.find(group => group.id === selectedGroupID.value))
let directoryVersion = 0
const retiring = ref<ModelHealthAccount | null>(null)
const state = ref<ModelHealthState | null>(null)
const metricsRange = ref<ModelHealthMetricsRange>('1h')
const pendingRange = ref<ModelHealthMetricsRange | null>(null)
const loading = ref(false), saving = ref(false), error = ref(''), editorError = ref('')
const search = ref(hallProvider), selectedID = ref(''), eventRule = ref(''), eventType = ref('')
const tabs = ['groups', 'overview', 'events'] as const
const activeTab = ref<typeof tabs[number]>('groups')
const directoryMetric = computed(() => ({ groups: 'readyChannels', overview: 'rules', events: 'eventCount' })[activeTab.value])
const modes = ['auto', 'primary', 'backup', 'observe'] as const
const draft = ref<ModelHealthRule | null>(null), editingID = ref(''), editRevision = ref(''), deleteID = ref('')
const numericFields = [
  { key: 'hold_seconds', label: 'hold', min: 0, max: 86400 }
] as const
// Only the server-verified upstream identity establishes AIHub membership.
const healthAccounts = computed(() => (state.value?.accounts ?? []).filter(item =>
  item.provider_supported === true && !isModelHealthExcludedAccount(item.id)))
const accountIndex = computed(() => new Map(healthAccounts.value.map(item => [item.id, item])))
const account = (id: number) => accountIndex.value.get(id)
const rawAccountIDs = computed(() => new Set((state.value?.accounts ?? []).map(item => item.id)))
const missingAccountSet = computed(() => new Set(state.value?.missing_account_ids ?? []))
const isMissingAccount = (id: number) => {
  if (!id || isModelHealthExcludedAccount(id)) return false
  if (Array.isArray(state.value?.missing_account_ids)) return missingAccountSet.value.has(id)
  return !rawAccountIDs.value.has(id)
}
const isVisibleRuleAccount = (id: number) => !!account(id) || isMissingAccount(id)
const ruleMissingIDs = (rule: ModelHealthRule) => [rule.primary_id, ...(rule.backup_ids ?? [])].filter(isMissingAccount)
const staleProviderBindings = computed(() => Object.entries(state.value?.settings.provider_groups ?? {}).filter(([id]) => isMissingAccount(Number(id))))
const healthRules = computed(() => (state.value?.settings.rules ?? []).flatMap(rule => {
  const backups = rule.backup_ids ?? []
  if (!isVisibleRuleAccount(rule.primary_id) || backups.some(id => !isVisibleRuleAccount(id))) return []
  return [rule.backup_ids ? rule : { ...rule, backup_ids: backups }]
}))
const groups = computed(() => {
  const byID = new Map(groupDirectory.value.map(group => [group.id, group]))
  for (const item of healthAccounts.value) {
    for (const id of item.group_ids ?? []) {
      if (!byID.has(id)) byID.set(id, { id, name: `#${id}` })
    }
  }
  for (const rule of healthRules.value) {
    const id = rule.group_id
    if (id && !byID.has(id)) byID.set(id, { id, name: `#${id}` })
  }
  return [...byID.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id - b.id)
})
const groupName = (id: number) => groups.value.find(group => group.id === id)?.name ?? `#${id}`
function groupOptionLabel(group: RoutingGroup) {
  const label = group.name === `#${group.id}` ? group.name : `${group.name} #${group.id}`
  return group.status && group.status !== 'active' ? `${label} · ${t('admin.modelHealth.paused')}` : label
}
const platformLabel = (platform?: string) => platform ? supplierPlatformLabels[platform] ?? platform : '-'
const groupRows = computed(() => {
  const members = new Map<number, ModelHealthAccount[]>()
  const ruleCounts = new Map<number, number>(), eventCounts = new Map<number, number>()
  for (const group of ruleOwners.value.values()) ruleCounts.set(group, (ruleCounts.get(group) ?? 0) + 1)
  for (const event of healthEvents.value) {
    const group = event.group_id ?? ruleOwners.value.get(event.rule_id)
    if (group) eventCounts.set(group, (eventCounts.get(group) ?? 0) + 1)
  }
  for (const item of healthAccounts.value) {
    for (const id of item.group_ids ?? []) {
      const rows = members.get(id) ?? []
      rows.push(item); members.set(id, rows)
    }
  }
  const term = groupSearch.value.trim().toLowerCase()
  return groups.value.flatMap(group => {
    const items = members.get(group.id) ?? []
    if (term) {
      const linked = term === hallProvider.toLowerCase() && hallProviderID > 0
      const known = items.some(item => (state.value?.provider_bindings?.[item.id] ?? state.value?.settings.provider_groups?.[item.id] ?? state.value?.providers?.accounts[item.id]?.group_id) === hallProviderID)
      const text = [group.name, `#${group.id}`, group.description, platformLabel(group.platform), ...items.flatMap(item => [item.name, state.value?.providers?.accounts[item.id]?.code])].join(' ').toLowerCase()
      if (linked ? !known : !text.includes(term)) return []
    }
    return [{ group, ready: items.filter(item => item.ready).length, total: items.length, rules: ruleCounts.get(group.id) ?? 0, events: eventCounts.get(group.id) ?? 0 }]
  })
})
function selectGroup(id: number) {
  selectedGroupID.value = id
  void router.replace({ query: { ...route.query, group: id ? String(id) : undefined } })
}
function editDescription() {
  descriptionDraft.value = directoryGroup.value?.description ?? ''
  descriptionError.value = ''
  editingDescription.value = true
}
async function saveDescription() {
  const group = directoryGroup.value
  if (!group || descriptionSaving.value) return
  if ((group.description ?? '') === descriptionDraft.value) { editingDescription.value = false; return }
  descriptionSaving.value = true
  try {
    const saved = await updateGroup(group.id, { description: descriptionDraft.value })
    directoryVersion++
    groupDirectory.value = groupDirectory.value.map(item => item.id === group.id ? { ...item, description: saved.description } : item)
    editingDescription.value = false; app.showSuccess(t('common.saved'))
  } catch (cause) { descriptionError.value = message(cause) }
  finally { descriptionSaving.value = false }
}
const accountName = (id: number) => account(id)?.group_ids?.includes(selectedGroupID.value) ? account(id)!.name : `${t('admin.modelHealth.missing')} #${id}`
const runtime = (id: string) => state.value?.runtime[id]
const observation = (id: string, accountID: number) => runtime(id)?.observations[String(accountID)]
const monitoredAccounts = computed(() => healthAccounts.value.filter(item => (item.platform ?? 'openai') === 'openai'))
const inGroup = (item: ModelHealthAccount, id: number) => !!item.group_ids?.includes(id)
const draftAccounts = computed(() => monitoredAccounts.value.filter(item => inGroup(item, selectedGroupID.value)).map(item => scopedAccount(item, selectedGroupID.value)))
const canAddRule = computed(() => draftAccounts.value.length > 0)
const isDraftChannel = (id: number) => draftAccounts.value.some(item => item.id === id)

function scopedAccount(item: ModelHealthAccount, id: number) {
  const controls = item.group_model_controls?.[String(id)]
  if (!controls) return item
  const models = { ...item.models }
  for (const [model, control] of Object.entries(controls)) {
    if (control.enabled) models[model] = control.model || models[model] || model
    else delete models[model]
  }
  return { ...item, models, model_controls: controls }
}
function accountInRule(id: number, rule: ModelHealthRule) {
  const item = account(id)
  return item && scopedAccount(item, rule.group_id ?? 0)
}
function ruleOwner(rule: ModelHealthRule) {
  if (rule.group_id) return rule.group_id
  // A legacy control follows its account into every group. Attribute it only when existing channels have one identical owner.
  const memberships = [rule.primary_id, ...rule.backup_ids].map(id => account(id)?.group_ids).filter((ids): ids is number[] => Array.isArray(ids))
  const owner = memberships[0]?.[0] ?? 0
  return owner && memberships.every(ids => ids.length === 1 && ids[0] === owner) ? owner : 0
}
const ruleOwners = computed(() => new Map(healthRules.value.map(rule => [rule.id, ruleOwner(rule)])))
const unownedOrphanRules = computed(() =>
  healthRules.value.filter(rule => !ruleOwners.value.get(rule.id) && ruleMissingIDs(rule).length > 0))
const ruleGroupLabel = (rule: ModelHealthRule) => rule.group_id ? groupName(rule.group_id) : t('admin.modelHealth.legacyGroup')
const scopedRules = computed(() => healthRules.value.filter(rule => selectedGroupID.value > 0 && ruleOwners.value.get(rule.id) === selectedGroupID.value))
const sharedLegacyCount = computed(() => healthRules.value.filter(rule => !ruleOwners.value.get(rule.id) &&
  [rule.primary_id, ...rule.backup_ids].some(id => account(id)?.group_ids?.includes(selectedGroupID.value))).length)
const scopedState = computed(() => {
  const current = state.value
  if (!current || !selectedGroupID.value) return null
  const id = selectedGroupID.value
  return {
    ...current,
    settings: { ...current.settings, rules: scopedRules.value },
    accounts: healthAccounts.value.filter(item => inGroup(item, id)).map(item => scopedAccount(item, id)),
  }
})
// Hall probe cards can include placeholders for models the channel does not offer.
const offeredModels = (id: number) => (state.value?.providers?.accounts[String(id)]?.supported_models ?? []).map(item => item.model)
const concreteModels = (ids: string[]) => [...new Set(ids.filter(id => id && !/[\s*?]/.test(id)))].sort()
const models = computed(() => concreteModels(draftAccounts.value.flatMap(item => [...Object.keys(item.models), ...offeredModels(item.id)])))
const upstreamModels = computed(() => concreteModels(draftAccounts.value
  .filter(item => !draft.value?.primary_id || draft.value.primary_id === item.id)
  .flatMap(item => [...Object.values(item.models), ...offeredModels(item.id)])))
const filteredRules = computed(() => scopedRules.value.filter(rule =>
  `${rule.name} ${rule.model} ${ruleGroupLabel(rule)} ${accountName(rule.primary_id)} ${rule.backup_ids.map(accountName).join(' ')}`.toLowerCase().includes(search.value.toLowerCase())))
const selectedRule = computed(() => filteredRules.value.find(rule => rule.id === selectedID.value) ?? filteredRules.value[0])
const unmanagedModels = computed(() => {
  if (!selectedGroupID.value || !scopedState.value) return []
  const managed = new Set(scopedRules.value.map(rule => rule.model))
  const byName = new Map<string, { model: string; accounts: number[]; ruleEligible: boolean }>()
  for (const item of scopedState.value.accounts) {
    const eligible = monitoredAccounts.value.some(account => account.id === item.id)
    for (const model of concreteModels([...Object.keys(item.models), ...offeredModels(item.id)])) {
      if (managed.has(model) || !`${model} ${item.name}`.toLowerCase().includes(search.value.toLowerCase())) continue
      const row = byName.get(model) ?? { model, accounts: [], ruleEligible: false }
      row.accounts.push(item.id)
      row.ruleEligible ||= eligible
      byName.set(model, row)
    }
  }
  return [...byName.values()].sort((a, b) => a.model.localeCompare(b.model))
})
const backupCandidates = computed(() => {
  const primary = account(draft.value?.primary_id ?? 0)
  return draftAccounts.value.filter(item => item.id !== primary?.id && !draft.value?.backup_ids.includes(item.id) && !supplyIssue(item.id))
})
function supplyIssue(id: number) {
  if (!draft.value || !draft.value.model.trim()) return undefined
  const item = accountInRule(id, draft.value), source = state.value?.providers
  const provider = source?.accounts[String(id)]
  if (!source || source.stale || source.error || !provider ||
    (!provider.catalog_known && !provider.supported_models?.length)) return 'admin.supplierHall.unknownCatalog'
  const requested = draft.value.model.trim()
  const pattern = Object.keys(item?.models ?? {}).filter(key => key.endsWith('*') && requested.startsWith(key.slice(0, -1))).sort((a, b) => b.length - a.length)[0]
  const target = draft.value.upstream_model.trim() || item?.models[requested] || (pattern && item?.models[pattern]) || requested
  if (!provider.supported_models?.some(row => row.model === target)) return 'admin.supplierHall.knownDelisted'
  return undefined
}
function obsAdvisories(obs?: ModelHealthObservation): ModelHealthProviderAdvisory[] {
  const list = [...(obs?.upstream_advisories ?? [])]
  if (obs?.high_error_advisory && obs.status !== 'failed' && obs.status !== 'unavailable' && !list.some(item => item.id === 'high_error')) {
    list.push({
      id: 'high_error', source_group_id: obs.source_group_id ?? 0, window: '', scope: 'all recorded models',
      classification: 'non_success', numerator: 0, denominator: 0, percent: 0, threshold: 0
    })
  }
  return list
}
const summary = computed(() => {
  const states = scopedRules.value.flatMap(rule => {
    const current = runtime(rule.id)
    return current ? [current] : []
  })
  const advisoryKeys = new Set<string>()
  const affectedRuleIDs = new Set<string>()
  let confirmedFailedRules = 0
  let healthyPrimaryRules = 0
  for (const rule of scopedRules.value) {
    const primaryObs = observation(rule.id, rule.primary_id)
    if (primaryObs?.status === 'healthy') healthyPrimaryRules++
    const channelIDs = [rule.primary_id, ...rule.backup_ids]
    if (channelIDs.some(id => isLocalConfirmedFailed(observation(rule.id, id)))) confirmedFailedRules++
    for (const id of channelIDs) {
      const obs = observation(rule.id, id)
      for (const adv of obsAdvisories(obs)) {
        const key = `${adv.source_group_id || obs?.source_group_id || id}:${adv.id}:${adv.classification || ''}:${adv.window || ''}:${adv.scope || ''}`
        advisoryKeys.add(key)
        affectedRuleIDs.add(rule.id)
      }
    }
  }
  return [
    { key: 'rules', testId: 'summary-rules', label: t('admin.modelHealth.rules'), value: scopedRules.value.length, color: '' },
    { key: 'healthy', testId: 'summary-healthy', label: t('admin.modelHealth.healthy'), value: healthyPrimaryRules, color: 'text-emerald-600' },
    { key: 'failed', testId: 'summary-failed', label: t('admin.modelHealth.localConfirmedFailed'), value: confirmedFailedRules, color: confirmedFailedRules ? 'text-red-600' : '' },
    { key: 'advisories', testId: 'summary-upstream-advisories', label: t('admin.modelHealth.upstreamWarnings'), value: advisoryKeys.size, color: advisoryKeys.size ? 'text-amber-600' : '' },
    { key: 'affected', testId: 'summary-affected-rules', label: t('admin.modelHealth.affectedRules'), value: affectedRuleIDs.size, color: affectedRuleIDs.size ? 'text-amber-600' : '' },
    { key: 'backup', testId: 'summary-backup', label: t('admin.modelHealth.backupActive'), value: states.filter(item => item.route === 'backup').length, color: 'text-amber-600' }
  ]
})
const healthEvents = computed(() => {
  const hiddenRules = new Set((state.value?.settings.rules ?? []).filter(rule => !ruleOwners.value.has(rule.id)).map(rule => rule.id))
  return (state.value?.events ?? []).filter(event => !hiddenRules.has(event.rule_id) && (!event.account_id || accountIndex.value.has(event.account_id) || isMissingAccount(event.account_id)))
})
const scopedEvents = computed(() => healthEvents.value.filter(event =>
  selectedGroupID.value > 0 && (event.group_id ?? ruleOwners.value.get(event.rule_id)) === selectedGroupID.value))
const eventRuleOptions = computed(() => {
  const options = new Map(scopedRules.value.map(rule => [rule.id, rule.name]))
  for (const event of scopedEvents.value) if (event.rule_id && !options.has(event.rule_id)) options.set(event.rule_id, event.rule_name || event.rule_id)
  return options
})
const eventName = (event: ModelHealthEvent) => event.rule_name || eventRuleOptions.value.get(event.rule_id) || event.rule_id
const eventMessage = (event: ModelHealthEvent) => event.type === 'switch' ? reasonLabel(event.message)
  : event.type === 'config' && ['rule_added', 'rule_updated', 'rule_removed'].includes(event.message) ? t(`admin.modelHealth.configEvents.${event.message}`) : event.message || '-'
const filteredEvents = computed(() => scopedEvents.value.filter(event =>
  (!eventRule.value || event.rule_id === eventRule.value) && (!eventType.value || event.type === eventType.value) &&
  `${eventName(event)} ${accountName(event.account_id ?? 0)} ${eventMessage(event)} ${event.status}`.toLowerCase().includes(search.value.toLowerCase())))
function formatTime(value?: string | null) { return value ? new Date(value).toLocaleString() : '-' }
function reasonLabel(reason?: string) { return reason ? (te(`admin.modelHealth.reasons.${reason}`) ? t(`admin.modelHealth.reasons.${reason}`) : reason) : '-' }
function observationError(error?: string) { return error && te(`admin.modelHealth.providerErrors.${error}`) ? t(`admin.modelHealth.providerErrors.${error}`) : error }
function advisoryName(id: string) {
  return te(`admin.modelHealth.providerWarningNames.${id}`) ? t(`admin.modelHealth.providerWarningNames.${id}`)
    : id === 'slow_headers' ? t('admin.modelHealth.providerWarningNames.slow_response') : id
}
function advisoryLabel(adv: ModelHealthProviderAdvisory) {
  if (adv.id === 'high_error' && !adv.window) return t('admin.modelHealth.highErrorAdvisory')
  return t('admin.modelHealth.upstreamAdvisoryDetail', {
    name: advisoryName(adv.id),
    window: adv.window || '-',
    percent: Number.isFinite(adv.percent) ? adv.percent.toFixed(2) : '0.00',
    numerator: adv.numerator ?? 0,
    denominator: adv.denominator ?? 0
  })
}
function modelCardLabel(obs?: ModelHealthObservation) {
  if (obs?.delisted) return t('admin.supplierHall.knownDelisted')
  if (obs?.error === 'provider_traffic_not_fresh') return t('admin.modelHealth.waitingForFreshStats')
  const cardStatus = obs?.provider_model_status || (obs?.status === 'healthy' || obs?.status === 'failed' || obs?.status === 'unavailable' ? obs.status : 'unknown')
  const label = healthLabel(cardStatus)
  return obs?.traffic && !obs.error ? `${label} · ${t('admin.modelHealth.hourlyTraffic')}` : label
}
function modelCardColor(obs?: ModelHealthObservation) {
  if (obs?.delisted) return 'text-red-600'
  const cardStatus = obs?.provider_model_status || obs?.status
  return healthColor(cardStatus)
}
function isLocalConfirmedFailed(obs?: ModelHealthObservation) {
  const local = obs?.local_outcomes
  if (!local || local.failures < 2 || local.failures < local.successes || !local.last_failure) return false
  const nowMs = state.value?.providers?.generated_at ? Date.parse(state.value.providers.generated_at) : Date.now()
  const asOfMs = Date.parse(local.as_of)
  const lastFailureMs = Date.parse(local.last_failure)
  if (!Number.isFinite(nowMs) || !Number.isFinite(asOfMs) || !Number.isFinite(lastFailureMs)) return false
  return asOfMs <= nowMs && nowMs - asOfMs <= 30_000 && lastFailureMs <= asOfMs && nowMs - lastFailureMs <= 60_000
}
function localOutcomeState(obs?: ModelHealthObservation) {
  if (obs?.local_error) return 'error'
  const local = obs?.local_outcomes
  if (!local || (local.successes === 0 && local.failures === 0)) return 'no_samples'
  if (isLocalConfirmedFailed(obs)) return 'failed'
  if (local.failures === 0 && local.successes > 0) return 'healthy'
  return 'mixed'
}
function localOutcomeLabel(obs?: ModelHealthObservation) {
  const kind = localOutcomeState(obs)
  if (kind === 'error') return t('admin.modelHealth.localReadFailed')
  if (kind === 'no_samples') return t('admin.modelHealth.localNoSamples')
  return t('admin.modelHealth.localOutcomes', { successes: obs!.local_outcomes!.successes, failures: obs!.local_outcomes!.failures })
}
function localOutcomeColor(obs?: ModelHealthObservation) {
  const kind = localOutcomeState(obs)
  if (kind === 'failed') return 'text-red-600'
  if (kind === 'healthy') return 'text-emerald-600'
  if (kind === 'error' || kind === 'mixed') return 'text-amber-600'
  return 'text-gray-500'
}
function trafficDetails(obs?: ModelHealthObservation) {
  const data = obs?.traffic
  return data ? t('admin.modelHealth.hourlyTrafficDetails', {
    count: data.samples.toLocaleString(), rate: (data.success_rate * 100).toFixed(2), time: formatTime(data.window_end)
  }) : ''
}
function healthColor(status?: string) { return status === 'healthy' ? 'text-emerald-600' : status === 'failed' ? 'text-red-600' : 'text-gray-500' }
function healthLabel(status?: string) {
  if (!status) return t('admin.modelHealth.unknown')
  if (['healthy', 'failed', 'unknown', 'unavailable', 'pending', 'stale', 'inconclusive'].includes(status)) return t(`admin.modelHealth.${status}`)
  return te(`admin.modelHealth.routes.${status}`) ? t(`admin.modelHealth.routes.${status}`) : status
}
function routeLabel(rule: ModelHealthRule) {
  if (!rule.enabled) return t('admin.modelHealth.paused')
  if (rule.mode === 'observe') return t('admin.modelHealth.modes.observe')
  const current = runtime(rule.id)
  const label = t(`admin.modelHealth.routes.${current?.route || 'unmanaged'}`)
  return current?.active_account_id ? `${label} · ${roleLabel(rule, current.active_account_id)} · ${accountName(current.active_account_id)}` : label
}
function roleLabel(rule: ModelHealthRule, id: number) {
  return id === rule.primary_id ? t('admin.modelHealth.primary') : t('admin.modelHealth.backupNumber', { number: rule.backup_ids.indexOf(id) + 1 })
}
function moveBackup(index: number, direction: number) {
  if (!draft.value) return
  const next = index + direction
  if (next < 0 || next >= draft.value.backup_ids.length) return
  const ids = [...draft.value.backup_ids]
  ;[ids[index], ids[next]] = [ids[next]!, ids[index]!]
  draft.value.backup_ids = ids
}
function addBackup(event: Event) {
  const select = event.target as HTMLSelectElement
  const id = Number(select.value)
  if (draft.value && draft.value.backup_ids.length < 32 && backupCandidates.value.some(item => item.id === id)) draft.value.backup_ids.push(id)
  select.value = ''
}
function message(cause: unknown) { return (cause as { response?: { data?: { message?: string } } })?.response?.data?.message || t('admin.modelHealth.requestFailed') }
const rangeCache = new Map<ModelHealthMetricsRange, { value: ModelHealthState; at: number }>()
const rangeRequests = new Map<ModelHealthMetricsRange, Promise<ModelHealthState>>()
let requestVersion = 0, cacheVersion = 0, disposed = false
let prefetchTimer: ReturnType<typeof setTimeout> | undefined
function fetchRange(range: ModelHealthMetricsRange) {
  const existing = rangeRequests.get(range)
  if (existing) return existing
  const version = cacheVersion
  const request = getModelHealth(range).then(value => {
    if (!disposed && version === cacheVersion) rangeCache.set(range, { value, at: Date.now() })
    return value
  }).finally(() => { if (rangeRequests.get(range) === request) rangeRequests.delete(range) })
  rangeRequests.set(range, request)
  return request
}
// Reuse only range metrics; cached settings and health must never replace live state.
function cachedRange(value: ModelHealthState): ModelHealthState {
  const live = state.value
  if (!live) return value
  return { ...live, metrics: value.metrics, providers: live.providers && value.providers ? {
    ...live.providers, metrics_range: value.providers.metrics_range,
    metrics_updated_at: value.providers.metrics_updated_at, metrics_error: value.providers.metrics_error,
    metrics_stale: value.providers.metrics_stale,
    accounts: Object.fromEntries(Object.entries(live.providers.accounts).map(([id, group]) => {
      const metric = value.providers?.accounts[id]
      return [id, { ...group, metrics: metric?.metrics ?? { duration_ms: null, sample_count: 0, success_rate: null, tps: null, cache_hit_rate: null, input_price_per_million: null, effective_multiplier: null },
        model_metrics: metric?.model_metrics ?? {}, points: metric?.points ?? [], probe_points: metric?.probe_points ?? [], series_at: metric?.series_at }]
    }))
  } : live.providers }
}
async function prefetchRanges() {
  for (const range of ['24h', '7d', '1h'] as const) {
    if (disposed || saving.value) return
    if (Date.now() - (rangeCache.get(range)?.at ?? 0) < 60000) continue
    try { await fetchRange(range) } catch { /* Selected-range loads report errors. */ }
  }
}
function invalidateRanges() {
  requestVersion++; cacheVersion++
  rangeCache.clear(); rangeRequests.clear()
  loading.value = false; pendingRange.value = null
}
async function load(range: ModelHealthMetricsRange = metricsRange.value, source: 'interactive' | 'poll' = 'interactive') {
  if (saving.value || loading.value && pendingRange.value === range) return
  if (source === 'poll' && (loading.value || rangeRequests.has(range))) return
  const version = ++requestVersion
  const cached = rangeCache.get(range)
  if (range !== metricsRange.value && cached && Date.now() - cached.at < 60000) {
    state.value = cachedRange(cached.value); metricsRange.value = range
    loading.value = false; pendingRange.value = null; error.value = ''
    return
  }
  if (source === 'interactive') {
    loading.value = true
    pendingRange.value = range
  }
  try {
    const value = await fetchRange(range)
    if (version !== requestVersion || disposed) return
    state.value = value; metricsRange.value = range; error.value = ''
    if (!prefetchTimer) prefetchTimer = setTimeout(() => { prefetchTimer = undefined; void prefetchRanges() }, 300)
  }
  catch (cause) { if (version === requestVersion && !disposed) error.value = message(cause) }
  finally { if (source === 'interactive' && version === requestVersion && !disposed) { loading.value = false; pendingRange.value = null } }
}
async function saveSettings(settings: ModelHealthSettings) {
  invalidateRanges()
  saving.value = true
  try {
    const next = await saveModelHealth(settings, metricsRange.value)
    state.value = next
    if (next.apply_pending || next.error) {
      error.value = next.error ? `${t('admin.modelHealth.savedApplyPending')} (${next.error})` : t('admin.modelHealth.savedApplyPending')
    } else {
      error.value = ''
      app.showSuccess(t('common.saved'))
    }
  }
  finally { saving.value = false }
}
async function toggleEnabled(event: Event) {
  if (!state.value) return
  try { await saveSettings({ ...state.value.settings, enabled: (event.target as HTMLInputElement).checked }) }
  catch (cause) { error.value = message(cause); (event.target as HTMLInputElement).checked = state.value.settings.enabled }
}
async function bindProvider(accountID: number, groupID: number) {
  if (!state.value || saving.value || !account(accountID)?.group_ids?.includes(selectedGroupID.value)) return
  const provider_groups = { ...state.value.settings.provider_groups }
  if (groupID || state.value.provider_bindings?.[String(accountID)]) provider_groups[String(accountID)] = groupID
  else delete provider_groups[String(accountID)]
  try {
    await saveSettings({ ...state.value.settings, provider_groups })
  } catch (cause) { error.value = message(cause) }
}
function editRule(rule?: ModelHealthRule, model = '') {
  if (!selectedGroupID.value || saving.value || (rule && ruleOwners.value.get(rule.id) !== selectedGroupID.value)) return
  editingID.value = rule?.id ?? ''
  editRevision.value = state.value?.settings.revision ?? ''
  editorError.value = ''
  draft.value = rule ? { ...rule, group_id: selectedGroupID.value, backup_ids: [...rule.backup_ids] } : {
    id: crypto.randomUUID(), group_id: selectedGroupID.value,
    name: model, model, upstream_model: '', primary_id: 0, backup_ids: [],
    enabled: true, mode: 'auto', interval_seconds: 180, timeout_seconds: 25, failure_threshold: 2, recovery_threshold: 2, hold_seconds: 90
  }
  draft.value.header_policy = rule?.header_policy
    ? { ...rule.header_policy, window_minutes: [...rule.header_policy.window_minutes] }
    : { enabled: true, wait_seconds: 120, rate_percent: 2, min_samples: 50, window_minutes: [5, 60] }
}
function changeDraftPrimary(event: Event) {
  if (!draft.value) return
  const primaryID = Number((event.target as HTMLSelectElement).value)
  if (!isDraftChannel(primaryID)) return
  editorError.value = ''
  draft.value = { ...draft.value, primary_id: primaryID, backup_ids: [] }
}
function closeEditor() { if (!saving.value) draft.value = null }
async function saveRule() {
  if (!state.value || !draft.value || saving.value) return
  const original = state.value.settings.rules.find(rule => rule.id === editingID.value)
  const allowExplicitDisable = !!original && !draft.value.enabled &&
    draft.value.primary_id === original.primary_id &&
    draft.value.backup_ids.every(id => isDraftChannel(id) || original.backup_ids.includes(id))
  if (!selectedGroupID.value || draft.value.group_id !== selectedGroupID.value || (editingID.value && (!original || ruleOwner(original) !== selectedGroupID.value)) ||
    (!allowExplicitDisable && [draft.value.primary_id, ...draft.value.backup_ids].some(id => !isDraftChannel(id)))) {
    editorError.value = t('admin.modelHealth.supplierChannelRequired')
    return
  }
  const updated = { ...draft.value, backup_ids: [...draft.value.backup_ids] }
  const rules = editingID.value ? state.value.settings.rules.map(rule => rule.id === editingID.value ? updated : rule) : [...state.value.settings.rules, updated]
  try {
    await saveSettings({ ...state.value.settings, revision: editRevision.value, rules })
    if (selectedGroupID.value === updated.group_id) selectedID.value = updated.id
    draft.value = null
  } catch (cause) { editorError.value = message(cause) }
}
function canManageRule(ruleId: string) {
  if (selectedGroupID.value && ruleOwners.value.get(ruleId) === selectedGroupID.value) return true
  return !selectedGroupID.value && unownedOrphanRules.value.some(item => item.id === ruleId)
}
async function disableRule(rule: ModelHealthRule) {
  if (!state.value || saving.value || !canManageRule(rule.id)) return
  try {
    await saveSettings({
      ...state.value.settings,
      rules: state.value.settings.rules.map(item => item.id === rule.id ? { ...item, enabled: false } : item)
    })
  } catch (cause) { error.value = message(cause) }
}
async function clearStaleBindings() {
  if (!state.value || saving.value) return
  const provider_groups = { ...state.value.settings.provider_groups }
  for (const [id] of staleProviderBindings.value) delete provider_groups[id]
  try {
    await saveSettings({ ...state.value.settings, provider_groups })
  } catch (cause) { error.value = message(cause) }
}
async function removeRule() {
  if (!state.value || saving.value || !canManageRule(deleteID.value)) return
  try {
    await saveSettings({ ...state.value.settings, rules: state.value.settings.rules.filter(rule => rule.id !== deleteID.value) })
    deleteID.value = ''
  } catch (cause) { error.value = message(cause); deleteID.value = '' }
}
function handleRetired() {
  retiring.value = null
  app.showSuccess(t('admin.supplierHall.retired'))
  invalidateRanges()
  refresh()
}
async function probe(id: string) {
  if (loading.value || saving.value || !selectedGroupID.value || ruleOwners.value.get(id) !== selectedGroupID.value) return
  invalidateRanges()
  saving.value = true
  try { state.value = await probeModelHealth(id, metricsRange.value); error.value = '' }
  catch (cause) { error.value = message(cause) }
  finally { saving.value = false }
}
function exportEvents() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(filteredEvents.value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = `model-health-group-${selectedGroupID.value}-events.json`; link.click()
  URL.revokeObjectURL(url)
}
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') { closeEditor(); deleteID.value = '' } }
let timer: ReturnType<typeof setInterval> | undefined
async function loadGroups() {
  const version = ++directoryVersion
  try {
    const directory = await getAllIncludingInactive()
    if (version !== directoryVersion || disposed) return
    groupDirectory.value = directory
    directoryLoaded.value = true
    groupError.value = false
  } catch {
    if (version === directoryVersion && !disposed) groupError.value = true
  }
}
function refresh() { void load(); void loadGroups() }
watch(draftAccounts, () => {
  const current = draft.value
  if (!current || current.group_id !== selectedGroupID.value) return
  const original = editingID.value ? state.value?.settings.rules.find(rule => rule.id === editingID.value) : undefined
  if ([current.primary_id, ...current.backup_ids].some(id => id && !isDraftChannel(id) && !(original && isMissingAccount(id)))) {
    draft.value = { ...current, primary_id: 0, backup_ids: [] }
    editorError.value = t('admin.modelHealth.supplierChannelRequired')
  }
})
watch(() => route.query.group, raw => { selectedGroupID.value = queryID(raw) })
watch([groups, directoryLoaded, selectedGroupID], () => {
  if (state.value && directoryLoaded.value && !groupError.value && selectedGroupID.value && !groups.value.some(g => g.id === selectedGroupID.value)) selectGroup(0)
})
watch(selectedGroupID, () => {
  selectedID.value = ''; eventRule.value = ''; eventType.value = ''; draft.value = null; deleteID.value = ''; retiring.value = null; editingDescription.value = false
  search.value = groupSearch.value === hallProvider ? hallProvider : ''
})
onMounted(() => { refresh(); timer = setInterval(() => { if (!document.hidden) void load(metricsRange.value, 'poll') }, 1000); document.addEventListener('keydown', onKey) })
onUnmounted(() => { disposed = true; if (timer) clearInterval(timer); if (prefetchTimer) clearTimeout(prefetchTimer); document.removeEventListener('keydown', onKey) })
</script>
