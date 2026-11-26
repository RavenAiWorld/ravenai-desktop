export type SetupClient = 'claude' | 'codex' | 'opencode' | 'gemini' | 'python' | 'curl'
export type SetupShell = 'powershell' | 'cmd' | 'unix'

export interface SetupFileBlock {
  path: string
  hint?: string
  content: string
}

export function splitEndpoints(baseUrl: string): { root: string; openai: string; anthropic: string; gemini: string } {
  const clean = (baseUrl || 'https://api.ravenaiworld.org/v1').trim()
  try {
    const url = new URL(clean)
    const path = url.pathname.replace(/\/+$/, '').replace(/(?:\/v1)+$/, '')
    const root = `${url.origin}${path}`
    const suffix = `${url.search}${url.hash}`
    return {
      root: `${root}${suffix}`,
      openai: `${root}/v1${suffix}`,
      anthropic: `${root}${suffix}`,
      gemini: `${root}/v1beta${suffix}`,
    }
  } catch {
    const trimmed = clean.replace(/\/+$/, '')
    const root = trimmed.replace(/\/v1$/, '')
    return {
      root,
      openai: trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`,
      anthropic: root,
      gemini: `${root}/v1beta`,
    }
  }
}

export function buildSetupBlocks(
  client: SetupClient,
  shell: SetupShell,
  baseUrl: string,
  apiKey: string,
  platform?: string,
): SetupFileBlock[] {
  const ep = splitEndpoints(baseUrl)
  const isAntigravity = platform === 'antigravity'
  const claudeBase = isAntigravity ? `${ep.root}/antigravity` : ep.anthropic
  const openaiBase = isAntigravity ? `${ep.root}/antigravity/v1` : ep.openai
  const geminiBase = isAntigravity ? `${ep.root}/antigravity/v1beta` : ep.gemini

  if (client === 'claude') {
    const envBlock =
      shell === 'powershell'
        ? `$env:ANTHROPIC_BASE_URL="${claudeBase}"\n$env:ANTHROPIC_AUTH_TOKEN="${apiKey}"\nclaude`
        : shell === 'cmd'
          ? `set ANTHROPIC_BASE_URL=${claudeBase}\nset ANTHROPIC_AUTH_TOKEN=${apiKey}\nclaude`
          : `export ANTHROPIC_BASE_URL="${claudeBase}"\nexport ANTHROPIC_AUTH_TOKEN="${apiKey}"\nclaude`
    const settingsJson = JSON.stringify(
      {
        env: {
          ANTHROPIC_BASE_URL: claudeBase,
          ANTHROPIC_AUTH_TOKEN: apiKey,
        },
      },
      null,
      2,
    )
    return [
      {
        path: shell === 'unix' ? '~/.claude/settings.json' : '%USERPROFILE%\\.claude\\settings.json',
        hint: '推荐写入持久化配置；Anthropic 协议地址不含 /v1 后缀',
        content: settingsJson,
      },
      {
        path: shell === 'powershell' ? 'PowerShell 临时启动' : shell === 'cmd' ? 'CMD 临时启动' : 'Terminal 临时启动',
        content: envBlock,
      },
    ]
  }

  if (client === 'codex') {
    const configPath = shell === 'unix' ? '~/.codex/config.toml' : '%USERPROFILE%\\.codex\\config.toml'
    const authPath = shell === 'unix' ? '~/.codex/auth.json' : '%USERPROFILE%\\.codex\\auth.json'
    const toml = [
      'model_provider = "ravenai"',
      'model = "gpt-5.4"',
      'model_reasoning_effort = "high"',
      'disable_response_storage = true',
      '',
      '[model_providers.ravenai]',
      'name = "Ravenai"',
      `base_url = "${openaiBase}"`,
      'wire_api = "responses"',
      'requires_openai_auth = true',
    ].join('\n')
    const authJson = JSON.stringify({ OPENAI_API_KEY: apiKey }, null, 2)
    return [
      {
        path: configPath,
        hint: 'OpenAI / Codex 协议地址需包含 /v1 后缀',
        content: toml,
      },
      {
        path: authPath,
        content: authJson,
      },
    ]
  }

  if (client === 'opencode') {
    const useAnthropic = platform === 'anthropic'
    const cfg = {
      $schema: 'https://opencode.ai/config.json',
      provider: {
        ravenai: {
          npm: useAnthropic ? '@ai-sdk/anthropic' : '@ai-sdk/openai-compatible',
          name: 'Ravenai',
          options: {
            baseURL: useAnthropic ? claudeBase : openaiBase,
            apiKey,
          },
        },
      },
    }
    return [
      {
        path: 'opencode.json',
        content: JSON.stringify(cfg, null, 2),
      },
    ]
  }

  if (client === 'gemini') {
    const cmd =
      shell === 'powershell'
        ? `$env:GOOGLE_GEMINI_BASE_URL="${geminiBase}"\n$env:GEMINI_API_KEY="${apiKey}"\ngemini`
        : shell === 'cmd'
          ? `set GOOGLE_GEMINI_BASE_URL=${geminiBase}\nset GEMINI_API_KEY=${apiKey}\ngemini`
          : `export GOOGLE_GEMINI_BASE_URL="${geminiBase}"\nexport GEMINI_API_KEY="${apiKey}"\ngemini`
    return [
      {
        path: shell === 'powershell' ? 'PowerShell' : shell === 'cmd' ? 'Windows CMD' : 'macOS / Linux',
        content: cmd,
      },
    ]
  }

  if (client === 'python') {
    if (platform === 'anthropic') {
      return [
        {
          path: 'example_anthropic.py',
          content: [
            'from anthropic import Anthropic',
            '',
            'client = Anthropic(',
            `    base_url="${claudeBase}",`,
            `    api_key="${apiKey}",`,
            ')',
            '',
            'msg = client.messages.create(',
            '    model="claude-sonnet-4-6",',
            '    max_tokens=1024,',
            '    messages=[{"role": "user", "content": "Hello from Ravenai"}],',
            ')',
            'print(msg.content[0].text)',
          ].join('\n'),
        },
      ]
    }
    return [
      {
        path: 'example_openai.py',
        content: [
          'from openai import OpenAI',
          '',
          'client = OpenAI(',
          `    base_url="${openaiBase}",`,
          `    api_key="${apiKey}",`,
          ')',
          '',
          'resp = client.chat.completions.create(',
          '    model="gpt-5.4",',
          '    messages=[{"role": "user", "content": "Hello from Ravenai"}],',
          ')',
          'print(resp.choices[0].message.content)',
        ].join('\n'),
      },
    ]
  }

  const isAnthropic = platform === 'anthropic'
  return [
    {
      path: 'cURL',
      content: isAnthropic
        ? `curl -sS "${claudeBase}/v1/messages" \\\n  -H "x-api-key: ${apiKey}" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -H "content-type: application/json" \\\n  -d '{"model":"claude-sonnet-4-6","max_tokens":256,"messages":[{"role":"user","content":"Hello"}]}'`
        : `curl -sS "${openaiBase}/chat/completions" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"gpt-5.4","messages":[{"role":"user","content":"Hello"}]}'`,
    },
  ]
}
