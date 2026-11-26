import { initializeDesktopStorage } from './storage'

async function start() {
  try {
    await initializeDesktopStorage()
    await import('../main')
  } catch {
    const root = document.getElementById('app')!
    root.replaceChildren()
    const heading = document.createElement('h1')
    heading.textContent = 'Ravenai 暂时无法启动'
    const message = document.createElement('p')
    message.textContent = '无法读取受 Windows 保护的登录信息，请重新启动应用后重试。'
    const retry = document.createElement('button')
    retry.textContent = '重试'
    retry.onclick = () => location.reload()
    root.style.cssText = 'font:14px/1.7 system-ui;padding:80px;max-width:640px;margin:auto'
    root.append(heading, message, retry)
  }
}
void start()
