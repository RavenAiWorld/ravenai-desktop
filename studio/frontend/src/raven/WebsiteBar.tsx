import { useEffect, useState } from 'react';
import { ArrowLeft, Wallet } from 'lucide-react';
import { desktopBridge, refreshStudioBalance, studioContext } from './host';

export function WebsiteBar() {
  const [balance, setBalance] = useState(studioContext()!.balance);
  const prices = studioContext()!.catalog.groups.flatMap(group => Object.values(group.prices)).filter(price => Number.isFinite(price) && price >= 0);
  const minPrice = Math.min(...prices), maxPrice = Math.max(...prices);
  const priceLabel = prices.length === 0 ? '暂无可用生图线路' : `每张 ${minPrice === maxPrice ? minPrice : `${minPrice}-${maxPrice}`} 额度`;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void refreshStudioBalance().then(setBalance).catch(() => {});
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return <nav className="raven-website-bar" aria-label="网站账户">
    {window.parent === window && <a href="/dashboard"><ArrowLeft size={15} /><span>返回网站</span></a>}
    <span className="raven-studio-price">{priceLabel}</span>
    <button onClick={() => desktopBridge().navigate('purchase')}><Wallet size={15} /><span>余额 {Number(balance).toFixed(2)} ＋</span></button>
  </nav>;
}
