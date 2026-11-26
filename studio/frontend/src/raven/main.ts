import { desktopBridge, initializeStudio } from './host';
import { installStudioRuntime } from './runtime';

initializeStudio().then(async () => {
  installStudioRuntime();
  const { mountStudio } = await import('./mount');
  mountStudio();
  let attempts = 0;
  const ready = () => {
    const tools = document.querySelectorAll('[role=tab]').length;
    if (tools >= 8) desktopBridge().ready(tools, innerWidth, innerHeight);
    else if (++attempts < 200) setTimeout(ready, 50);
    else desktopBridge().failed('工作台界面加载未完成，请重新连接。');
  };
  ready();
}).catch(error => {
  const root = document.getElementById('root')!;
  root.textContent = error instanceof Error ? error.message : '工作台加载失败，请刷新重试。';
  try { desktopBridge().failed(root.textContent); } catch { /* Parent may have logged out. */ }
});
