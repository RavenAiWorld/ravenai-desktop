export default {
  batchImageGuide: {
    title: '图片批量生成',
    description: '一次提交多条提示词，任务完成后可统一下载图片结果'
  },
  // Home Page
  home: {
    raven: {
      navigation: '导航菜单',
      home: '首页',
      eyebrow: 'Ravenai · AI API',
      heroLine1: '把 AI 接入，',
      heroLine2: '变得简单。',
      heroDescription: '一个入口，连接你需要的 AI 模型。密钥、用量与费用，都在这里清晰掌握。',
      viewExample: '看看如何接入',
      previewTitle: '模型接入',
      previewHint: '熟悉的协议，统一的入口',
      protocol: '选择协议示例',
      protocolDescription: '沿用熟悉的请求格式，连接你的应用。',
      previewKey: '统一密钥',
      previewKeyHint: '在一处管理访问',
      previewUsage: '清晰用量',
      previewUsageHint: '每一次调用可查',
      trySwitch: '点选上方模型，预览接入方式',
      copyExample: '复制示例',
      exampleNotice: '替换示例中的密钥与模型名；可用模型以模型广场为准。',
      authTitle: '让想法，连接可能。',
      userOverview: '你的 AI 工作空间',
      userOverviewDescription: '查看账户概况，管理每一次调用。',
      adminOverview: '运营概览',
      adminOverviewDescription: '账号、请求与用量，尽在掌握。',
      exploreModels: '浏览模型',
      request: '请求',
      models: '连接多种 AI 模型',
      capabilities: 'CAPABILITIES / 功能',
      capabilitiesTitle: '需要的一切，恰到好处。',
      capabilitiesDescription: '从首次调用到日常管理，用清晰、熟悉的方式构建你的 AI 应用。',
      featureModelsTitle: '多模型接入',
      featureModelsDescription: '在模型广场查看可用模型和对应的价格信息，按需求选择。',
      featureKeysTitle: '密钥独立管理',
      featureKeysDescription: '创建并管理 API 密钥，根据需要控制使用额度和有效期。',
      featureUsageTitle: '用量清晰可查',
      featureUsageDescription: '在控制台查看请求记录、用量和费用，了解实际使用情况。',
      featureRoutingTitle: '灵活路由',
      featureRoutingDescription: '通过统一入口访问已配置的渠道与模型，减少接入时的重复工作。',
      quickstart: 'GET STARTED / 开始使用',
      quickstartTitle: '三步，开始构建。',
      quickstartDescription: '使用熟悉的请求格式，按站内模型信息选择适合自己的模型。',
      stepAccount: '进入控制台',
      stepAccountDescription: '登录你的账户，查看可用的模型和额度。',
      stepKey: '创建 API 密钥',
      stepKeyDescription: '在控制台生成密钥，并妥善保管。',
      stepConnect: '发起请求',
      stepConnectDescription: '将接口地址和模型名称填入你的应用。',
      openConsole: '进入控制台',
      example: '示例',
      footerDescription: '为你的 AI 应用提供统一接入。',
      compatBadge: '兼容 OpenAI · Anthropic · Gemini 协议',
      apiBaseLabel: 'API 地址',
      register: '注册',
      keyUsage: '用量查询',
      statModels: '可用模型',
      statVendors: '模型厂商',
      statGroups: '计费分组',
      statProtocols: '接入协议',
      pricingTitle: '模型与价格',
      pricingDescription: '实付单价已按分组倍率换算，单位为每百万 tokens。',
      pricingModel: '模型',
      pricingVendor: '厂商',
      pricingInput: '输入',
      pricingOutput: '输出',
      pricingContext: '上下文',
      pricingViewAll: '查看全部 {count} 个模型',
      ctaTitle: '几分钟内完成接入',
      ctaDescription: '注册账户、创建密钥，再把接口地址填进你的应用。'
    },
    viewOnGithub: '在 GitHub 上查看',
    viewDocs: '查看文档',
    docs: '文档',
    switchToLight: '切换到浅色模式',
    switchToDark: '切换到深色模式',
    dashboard: '控制台',
    login: '登录',
    getStarted: '立即开始',
    goToDashboard: '进入控制台',
    // 新增：面向用户的价值主张
    heroSubtitle: '一个密钥，畅用多个 AI 模型',
    heroDescription: '无需管理多个订阅账号，一站式接入 Claude、GPT、Gemini 等主流 AI 服务',
    tags: {
      subscriptionToApi: '订阅转 API',
      stickySession: '会话保持',
      realtimeBilling: '按量计费'
    },
    // 用户痛点区块
    painPoints: {
      title: '你是否也遇到这些问题？',
      items: {
        expensive: {
          title: '订阅费用高',
          desc: '每个 AI 服务都要单独订阅，每月支出越来越多'
        },
        complex: {
          title: '多账号难管理',
          desc: '不同平台的账号、密钥分散各处，管理起来很麻烦'
        },
        unstable: {
          title: '服务不稳定',
          desc: '单一账号容易触发限制，影响正常使用'
        },
        noControl: {
          title: '用量无法控制',
          desc: '不知道钱花在哪了，也无法限制团队成员的使用'
        }
      }
    },
    // 解决方案区块
    solutions: {
      title: '我们帮你解决',
      subtitle: '简单三步，开始省心使用 AI'
    },
    features: {
      unifiedGateway: '一键接入',
      unifiedGatewayDesc: '获取一个 API 密钥，即可调用所有已接入的 AI 模型，无需分别申请。',
      multiAccount: '稳定可靠',
      multiAccountDesc: '智能调度多个上游账号，自动切换和负载均衡，告别频繁报错。',
      balanceQuota: '用多少付多少',
      balanceQuotaDesc: '按实际使用量计费，支持设置配额上限，团队用量一目了然。'
    },
    // 优势对比
    comparison: {
      title: '为什么选择我们？',
      headers: {
        feature: '对比项',
        official: '官方订阅',
        us: '本平台'
      },
      items: {
        pricing: {
          feature: '付费方式',
          official: '固定月费，用不完也付',
          us: '按量付费，用多少付多少'
        },
        models: {
          feature: '模型选择',
          official: '单一服务商',
          us: '多模型随意切换'
        },
        management: {
          feature: '账号管理',
          official: '每个服务单独管理',
          us: '统一密钥，一站管理'
        },
        stability: {
          feature: '服务稳定性',
          official: '单账号易触发限制',
          us: '多账号池，自动切换'
        },
        control: {
          feature: '用量控制',
          official: '无法限制',
          us: '可设配额、查明细'
        }
      }
    },
    providers: {
      title: '已支持的 AI 模型',
      description: '一个 API，多种选择',
      supported: '已支持',
      soon: '即将推出',
      claude: 'Claude',
      gemini: 'Gemini',
      antigravity: 'Antigravity',
      more: '更多'
    },
    // CTA 区块
    cta: {
      title: '准备好开始了吗？',
      description: '注册即可获得免费试用额度，体验一站式 AI 服务',
      button: '免费注册'
    },
    footer: {
      allRightsReserved: '保留所有权利。'
    }
  },

  // Key Usage Query Page
  keyUsage: {
    title: 'API Key 用量查询',
    subtitle: '输入您的 API Key 以查看实时消费金额与使用状态',
    placeholder: 'sk-ant-mirror-xxxxxxxxxxxx',
    query: '查询',
    querying: '查询中...',
    privacyNote: '您的 Key 仅在浏览器本地处理，不会被存储',
    dateRange: '统计范围:',
    dateRangeToday: '今日',
    dateRange7d: '7 天',
    dateRange30d: '30 天',
    dateRange90d: '90 天',
    dateRangeCustom: '自定义',
    apply: '应用',
    used: '已使用',
    detailInfo: '详细信息',
    tokenStats: 'Token 统计',
    dailyDetail: '按日明细',
    modelStats: '模型用量统计',
    // Table headers
    date: '日期',
    model: '模型',
    requests: '请求数',
    inputTokens: '输入 Tokens',
    outputTokens: '输出 Tokens',
    cacheCreationTokens: '缓存创建',
    cacheReadTokens: '缓存读取',
    cacheWriteTokens: '缓存写入',
    totalTokens: '总 Tokens',
    cost: '费用',
    // Status
    quotaMode: 'Key 限额模式',
    walletBalance: '钱包余额',
    // Ring card titles
    totalQuota: '总额度',
    limit5h: '5 小时限额',
    limitDaily: '日限额',
    limit7d: '7 天限额',
    limitWeekly: '周限额',
    limitMonthly: '月限额',
    // Detail rows
    remainingQuota: '剩余额度',
    expiresAt: '过期时间',
    todayExpires: '(今日到期)',
    daysLeft: '({days} 天)',
    usedQuota: '已用额度',
    resetNow: '即将重置',
    subscriptionType: '订阅类型',
    billingType: '计费方式',
    subscriptionExpires: '订阅到期',
    // Usage stat cells
    todayRequests: '今日请求',
    todayInputTokens: '今日输入',
    todayOutputTokens: '今日输出',
    todayTokens: '今日 Tokens',
    todayCacheCreation: '今日缓存创建',
    todayCacheRead: '今日缓存读取',
    todayCost: '今日费用',
    rpmTpm: 'RPM / TPM',
    totalRequests: '累计请求',
    totalInputTokens: '累计输入',
    totalOutputTokens: '累计输出',
    totalTokensLabel: '累计 Tokens',
    totalCacheCreation: '累计缓存创建',
    totalCacheRead: '累计缓存读取',
    totalCost: '累计费用',
    avgDuration: '平均耗时',
    // Messages
    enterApiKey: '请输入 API Key',
    querySuccess: '查询成功',
    queryFailed: '查询失败',
    queryFailedRetry: '查询失败，请稍后重试',
    noDailyUsage: '暂无按日用量数据',
  },

  // Setup Wizard
  setup: {
    title: 'Ravenai 安装向导',
    description: '配置您的 Ravenai 实例',
    database: {
      title: '数据库配置',
      description: '连接到您的 PostgreSQL 数据库',
      host: '主机',
      port: '端口',
      username: '用户名',
      password: '密码',
      databaseName: '数据库名称',
      sslMode: 'SSL 模式',
      passwordPlaceholder: '密码',
      ssl: {
        disable: '禁用',
        require: '要求',
        verifyCa: '验证 CA',
        verifyFull: '完全验证'
      }
    },
    redis: {
      title: 'Redis 配置',
      description: '连接到您的 Redis 服务器',
      host: '主机',
      port: '端口',
      username: '用户名（可选）',
      password: '密码（可选）',
      database: '数据库',
      usernamePlaceholder: '默认用户留空',
      passwordPlaceholder: '密码',
      enableTls: '启用 TLS',
      enableTlsHint: '连接 Redis 时使用 TLS（公共 CA 证书）'
    },
    admin: {
      title: '管理员账户',
      description: '创建您的管理员账户',
      email: '邮箱',
      password: '密码',
      confirmPassword: '确认密码',
      passwordPlaceholder: '至少 8 个字符',
      confirmPasswordPlaceholder: '确认密码',
      passwordMismatch: '密码不匹配'
    },
    ready: {
      title: '准备安装',
      description: '检查您的配置并完成安装',
      database: '数据库',
      redis: 'Redis',
      adminEmail: '管理员邮箱'
    },
    status: {
      testing: '测试中...',
      success: '连接成功',
      testConnection: '测试连接',
      installing: '安装中...',
      completeInstallation: '完成安装',
      completed: '安装完成！',
      redirecting: '正在跳转到登录页面...',
      restarting: '服务正在重启，请稍候...',
      timeout: '服务重启时间超出预期，请手动刷新页面。'
    }
  },

  // Common
}
