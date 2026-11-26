import { defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import LoginView from '../LoginView.vue'
import RegisterView from '../RegisterView.vue'

const mocks = vi.hoisted(() => ({
  settings: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  passkey: vi.fn(),
  oauth: vi.fn(),
  verify: vi.fn(),
  reset: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  push: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push, currentRoute: { value: { query: {} } } }),
  useRoute: () => ({ query: {} })
}))
vi.mock('vue-i18n', () => ({
  createI18n: () => ({ global: { t: (key: string) => key } }),
  useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } })
}))
vi.mock('@/stores', () => ({
  useAuthStore: () => ({
    login: mocks.login,
    register: mocks.register,
    loginWithPasskey: mocks.passkey
  }),
  useAppStore: () => ({
    showWarning: mocks.warning,
    showError: mocks.error,
    showSuccess: vi.fn(),
    cachedPublicSettings: null
  })
}))
vi.mock('@/api/auth', async () => {
  const actual = await vi.importActual<typeof import('@/api/auth')>('@/api/auth')
  return {
    ...actual,
    getPublicSettings: mocks.settings,
    startOAuthLogin: mocks.oauth,
    isTotp2FARequired: () => false,
    isWeChatWebOAuthEnabled: () => false
  }
})

const CaptchaStub = defineComponent({
  props: { hcaptchaAction: Boolean },
  setup(_, { expose }) {
    expose({ verifyAction: mocks.verify, reset: mocks.reset })
    return () => h('div', { 'data-testid': 'action-captcha' })
  }
})
const OAuthStub = defineComponent({
  emits: ['start'],
  setup(_, { emit }) {
    return () => h('button', {
      type: 'button',
      'data-testid': 'oauth-start',
      onClick: () => emit('start', { provider: 'github', params: {} })
    })
  }
})
const settings = {
  registration_enabled: true,
  hcaptcha_enabled: true,
  hcaptcha_site_key: 'hcaptcha-site-key',
  turnstile_enabled: false,
  tencent_captcha_enabled: false,
  aliyun_captcha_enabled: false,
  login_agreement_enabled: true,
  login_agreement_mode: 'modal',
  login_agreement_revision: 'terms-v2',
  login_agreement_documents: [
    { id: 'service-terms', title: 'Terms' },
    { id: 'privacy-policy', title: 'Privacy' }
  ],
  registration_email_suffix_whitelist: [],
  email_verify_enabled: false,
  passkey_enabled: true,
  github_oauth_enabled: true
}
const wrappers: VueWrapper[] = []

function mountForm(kind: 'login' | 'register') {
  const wrapper = mount(kind === 'login' ? LoginView : RegisterView, {
    attachTo: document.body,
    global: {
      stubs: {
        AuthLayout: { template: '<main><slot /><slot name="footer" /></main>' },
        TurnstileWidget: CaptchaStub,
        Icon: true,
        RouterLink: { template: '<a><slot /></a>' },
        EmailOAuthButtons: OAuthStub,
        LinuxDoOAuthSection: true,
        DingTalkOAuthSection: true,
        OidcOAuthSection: true,
        WechatOAuthSection: true,
        TotpLoginModal: true,
        transition: false
      }
    }
  })
  wrappers.push(wrapper)
  return wrapper
}

async function fillForm(wrapper: VueWrapper, kind: 'login' | 'register') {
  await wrapper.get('#email').setValue('customer@example.com')
  await wrapper.get('#password').setValue('secret-123')
  if (kind === 'register') await wrapper.get('#confirmPassword').setValue('secret-123')
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  mocks.settings.mockResolvedValue(settings)
  mocks.login.mockResolvedValue({})
  mocks.register.mockResolvedValue({})
  mocks.verify.mockResolvedValue({ token: 'submit-proof', randstr: '' })
  Object.defineProperty(window, 'PublicKeyCredential', {
    configurable: true,
    value: class PublicKeyCredential {}
  })
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

describe.each(['login', 'register'] as const)('%s submit-triggered verification', kind => {
  it('allows typing without an initial agreement dialog or captcha request', async () => {
    const wrapper = mountForm(kind)
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.get('#email').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('#password').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.findComponent(CaptchaStub).props('hcaptchaAction')).toBe(true)
    expect(wrapper.get<HTMLInputElement>('#login-agreement-consent').element.checked).toBe(false)
    expect(mocks.verify).not.toHaveBeenCalled()
    expect(mocks.warning).not.toHaveBeenCalled()
  })

  it('validates missing fields before reminding about consent', async () => {
    const wrapper = mountForm(kind)
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.error).toHaveBeenCalledWith('auth.emailRequired')
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(mocks.verify).not.toHaveBeenCalled()
  })

  it('reminds and focuses the unchecked agreement only after the form is complete', async () => {
    const wrapper = mountForm(kind)
    await flushPromises()
    await fillForm(wrapper, kind)
    expect(mocks.warning).not.toHaveBeenCalled()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.warning).toHaveBeenCalledWith(`legal.loginAgreementPrompt.${kind}RequiredWarning`)
    expect(document.activeElement).toBe(wrapper.get('#login-agreement-consent').element)
    expect(mocks.verify).not.toHaveBeenCalled()
    expect(mocks.login).not.toHaveBeenCalled()
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('waits for a fresh proof, blocks double submission, and automatically continues', async () => {
    let resolve!: (proof: { token: string; randstr: string }) => void
    mocks.verify.mockReturnValueOnce(new Promise(result => { resolve = result }))
    const wrapper = mountForm(kind)
    await flushPromises()
    await fillForm(wrapper, kind)
    await wrapper.get('#login-agreement-consent').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.verify).toHaveBeenCalledOnce()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.verify).toHaveBeenCalledOnce()
    expect(mocks.login).not.toHaveBeenCalled()
    expect(mocks.register).not.toHaveBeenCalled()

    resolve({ token: 'fresh-proof', randstr: '' })
    await flushPromises()
    const submit = kind === 'login' ? mocks.login : mocks.register
    expect(submit).toHaveBeenCalledOnce()
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      email: 'customer@example.com',
      password: 'secret-123',
      turnstile_token: 'fresh-proof'
    }))
    expect(mocks.push).toHaveBeenCalledWith('/dashboard')
  })

  it('preserves input and allows retry after the captcha is cancelled', async () => {
    mocks.verify.mockResolvedValueOnce(null)
    const wrapper = mountForm(kind)
    await flushPromises()
    await fillForm(wrapper, kind)
    await wrapper.get('#login-agreement-consent').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.login).not.toHaveBeenCalled()
    expect(mocks.register).not.toHaveBeenCalled()
    expect(wrapper.get<HTMLInputElement>('#email').element.value).toBe('customer@example.com')
    expect(wrapper.get<HTMLInputElement>('#password').element.value).toBe('secret-123')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(kind === 'login' ? mocks.login : mocks.register).toHaveBeenCalledOnce()
    expect(mocks.verify).toHaveBeenCalledTimes(2)
  })

  it('does not warn immediately when the agreement is unchecked again', async () => {
    const wrapper = mountForm(kind)
    await flushPromises()
    await fillForm(wrapper, kind)
    await wrapper.get('#login-agreement-consent').setValue(true)
    await wrapper.get('#login-agreement-consent').setValue(false)
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(wrapper.get('#email').attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    expect(mocks.warning).toHaveBeenCalledOnce()
  })

  it('still enforces agreement for OAuth without requiring password input', async () => {
    const wrapper = mountForm(kind)
    await flushPromises()
    await wrapper.get('[data-testid="oauth-start"]').trigger('click')
    await flushPromises()
    expect(mocks.warning).toHaveBeenCalledOnce()
    expect(mocks.verify).not.toHaveBeenCalled()
    expect(mocks.oauth).not.toHaveBeenCalled()
  })
})

it('requires matching passwords before reminding about terms on registration', async () => {
  const wrapper = mountForm('register')
  await flushPromises()
  await fillForm(wrapper, 'register')
  await wrapper.get('#confirmPassword').setValue('mismatch')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(mocks.error).toHaveBeenCalledWith('auth.passwordsDoNotMatch')
  expect(mocks.warning).not.toHaveBeenCalled()
  expect(mocks.verify).not.toHaveBeenCalled()
})

it('passes the verified token into the existing email verification registration flow', async () => {
  mocks.settings.mockResolvedValueOnce({ ...settings, email_verify_enabled: true })
  const wrapper = mountForm('register')
  await flushPromises()
  await fillForm(wrapper, 'register')
  await wrapper.get('#login-agreement-consent').setValue(true)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(mocks.verify).toHaveBeenCalledOnce()
  expect(JSON.parse(sessionStorage.getItem('register_data')!)).toMatchObject({
    email: 'customer@example.com',
    turnstile_token: 'submit-proof'
  })
  expect(mocks.register).not.toHaveBeenCalled()
  expect(mocks.push).toHaveBeenCalledWith('/email-verify')
})

it('still blocks Passkey login until the agreement is checked', async () => {
  const wrapper = mountForm('login')
  await flushPromises()
  await wrapper.get('button.btn-secondary').trigger('click')
  await flushPromises()
  expect(mocks.warning).toHaveBeenCalledOnce()
  expect(mocks.passkey).not.toHaveBeenCalled()
  expect(mocks.verify).not.toHaveBeenCalled()
})
