import { useEffect, useState } from 'react'
import { ArrowUpRight, Gift, RefreshCw } from 'lucide-react'
import { site } from './native'
import { ErrorMessage, IconButton, useAction } from './ui'

export default function Purchase({ redeem }: { redeem: () => void }) {
  const [revision, setRevision] = useState(0)
  const [waiting, setWaiting] = useState(true)
  const [slow, setSlow] = useState(false)
  const action = useAction()
  useEffect(() => {
    setWaiting(true)
    setSlow(false)
    const timer = setTimeout(() => setSlow(true), 15_000)
    return () => clearTimeout(timer)
  }, [revision])
  return <section className="embedded-module purchase-module" aria-label="购买额度商店">
    <div className="purchase-toolbar">
      <span className="muted">wzyp.cn / Ravenai</span>
      <span className="spacer" />
      <button onClick={redeem}><Gift size={15} />兑换额度</button>
      <IconButton label="重新加载商店" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} className={waiting ? 'spin' : ''} /></IconButton>
      <IconButton label="在浏览器打开商店" onClick={() => action.run(() => site('/buy-credits'))}><ArrowUpRight size={16} /></IconButton>
    </div>
    <ErrorMessage error={action.error} />
    {waiting && slow && <p className="purchase-notice" role="status">商店仍在加载。请完成页面中的验证，或使用右上角按钮重新加载。</p>}
    <iframe key={revision} src="https://wzyp.cn/shop/ravenai" title="Ravenai 购买额度" className="shop-frame" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" onLoad={() => setWaiting(false)} />
  </section>
}
