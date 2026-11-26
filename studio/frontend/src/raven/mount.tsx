import { createRoot } from 'react-dom/client';
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';
import '@/app/globals.css';
import './studio.css';
import { migrateLegacyGallery } from './legacy-gallery';
import { WebsiteBar } from './WebsiteBar';

export function mountStudio() {
  createRoot(document.getElementById('root')!).render(<><WebsiteBar /><div className="raven-workspace"><WorkspaceShell /></div></>);
  void migrateLegacyGallery().catch(() => {
    // The legacy database is preserved; a later visit can resume this import.
    console.warn('旧版作品导入暂未完成，原作品仍保留在本机，重新打开工作台后会重试。');
  });
}
