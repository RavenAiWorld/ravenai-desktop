export default {
  imageStudio: {
    canvas: '无限画布', canvasQueueFull: '已有 4 个画布任务正在生成，请等待完成。', canvasSessionChanged: '登录账户已变化，请重新打开画布。',
    title: '生图工作台', description: '让想象，从一句话开始。', studio: '创作', gallery: '我的作品', inspiration: '灵感',
    badge: 'IMAGE STUDIO', headline: '把脑海里的画面，变成眼前的作品', subtitle: '描述你的想法，或上传参考图。从第一笔灵感开始。',
    balance: '可用余额', recharge: '充值', localGallery: '作品保存在当前浏览器，重要图片请及时下载。',
    prompt: '画面描述', placeholder: '描述你想创作的画面、风格、光线与细节…', reference: '参考图', addReference: '添加参考图', removeReference: '移除参考图',
    referenceHint: 'PNG、JPG、WebP · 每张不超过 10 MB · 最多 2 张', referenceError: '请选择不超过 10 MB 的 PNG、JPG 或 WebP 图片，最多 2 张。',
    model: '模型', group: '线路', size: '尺寸', ratio: '比例', quality: '画质', count: '数量',
    qualityAuto: '自动', qualityLow: '标准', qualityMedium: '精细', qualityHigh: '高精细',
    generate: '开始生成', generating: '正在创作', estimated: '预计', perImage: '/ 张', images: '{count} 张',
    priceNote: '按张计费，独立于文本模型倍率。实际尺寸由模型返回。',
    busyTitle: '你的想象正在成形', busyHint: '生成可能需要几分钟，请保持页面打开。', elapsed: '已等待 {seconds} 秒',
    emptyGallery: '第一张作品，从这里开始', emptyGalleryHint: '生成的图片会出现在这里。', startCreating: '去创作',
    tryPrompt: '使用这个灵感', download: '下载图片', reuse: '复用描述', useReference: '用作参考图', delete: '删除作品',
    deleteConfirm: '从当前浏览器删除这张作品？已下载的文件不受影响。', close: '关闭预览', preview: '查看图片',
    noGroups: '当前账户暂无可用的生图线路。', loadFailed: '生图配置加载失败，请重试。', retry: '重新加载',
    insufficient: '余额不足，请先充值。', failed: '本次生成未完成。请查看用量记录后，再决定是否重新生成。',
    interrupted: '连接中断或等待超时。任务可能仍在处理，请先查看用量记录，避免重复提交。',
    priceChanged: '价格已更新，请确认新价格后再次生成。', duplicate: '这个请求已经提交，请先查看作品和用量记录。',
    noImage: '请求返回成功，但没有可显示的图片。请查看用量记录。', storageFailed: '作品暂时无法保存到浏览器，请立即下载本次图片。',
    historyFailed: '本地作品暂时无法读取；仍可生成并下载图片。', leaveConfirm: '图片仍在生成，离开页面可能丢失结果，费用可能已经产生。确定离开？',
    usage: '查看用量', created: '生成于', back: '返回工作台', referenceMode: '参考图编辑', textMode: '文生图',
    presets: {
      landscape: { title: '一场远山的日落', category: '风景 · 胶片', prompt: '连绵的远山与安静的湖面，落日把天空染成桃粉色，一艘小船停在水中央，35mm 胶片摄影，柔和颗粒感，极简构图，宁静而诗意。' },
      product: { title: '日常，也有光', category: '产品 · 静物', prompt: '一只米白色手工陶瓷花瓶，插着一枝橄榄叶，放在暖色石台上，午后阳光投下斜向的窗影，高级产品摄影，自然质感，奶油色背景。' },
      illustration: { title: '小小的奇妙世界', category: '插画 · 想象', prompt: '一座漂浮在云端的小小花园，圆顶小屋、茂盛的树和蜿蜒的小路，温暖的粉彩配色，精致 3D 黏土插画，柔和光照，充满童趣。' },
      poster: { title: '给文字一点个性', category: '设计 · 海报', prompt: '一张现代主义艺术展海报，奶油白底色，橘红色圆形与深蓝色几何图形，鲜明的留白与网格排版，文字为「MAKE SOMETHING NEW」，干净的平面设计。' }
    }
  }
}
