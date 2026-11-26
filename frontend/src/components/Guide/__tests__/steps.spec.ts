import { describe, expect, it } from 'vitest'

import { getAdminSteps, getUserSteps } from '../steps'

const t = (key: string) => key
const elements = (steps: ReturnType<typeof getUserSteps>) => steps.map((step) => step.element).filter(Boolean)

describe('onboarding key-creation steps', () => {
  it('walks regular users from the key name straight to submit, with no group step', () => {
    const userElements = elements(getUserSteps(t))

    expect(userElements).not.toContain('[data-tour="key-form-group"]')
    const nameIndex = userElements.indexOf('[data-tour="key-form-name"]')
    expect(userElements[nameIndex + 1]).toBe('[data-tour="key-form-submit"]')
  })

  it('still shows admins the group step', () => {
    expect(elements(getAdminSteps(t))).toContain('[data-tour="key-form-group"]')
  })
})
