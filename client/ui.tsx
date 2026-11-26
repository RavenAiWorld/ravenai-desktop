import { cloneElement, createContext, isValidElement, useContext, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { AlertCircle, Check, ChevronLeft, ChevronRight, Copy, LoaderCircle, Search, X } from 'lucide-react'

export const NoticeContext = createContext<(text: string) => void>(() => {})
export const useNotice = () => useContext(NoticeContext)
export function useAction() {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return false
    setBusy(true); setError('')
    try { await action(); return true } catch (e) { setError(e instanceof Error ? e.message : String(e)); return false }
    finally { setBusy(false) }
  }
  return { busy, error, run, setError }
}
export function ErrorMessage({ error, retry }: { error?: unknown; retry?: () => unknown }) {
  if (!error) return null
  return <div className="error" role="alert"><AlertCircle size={17}/><span>{error instanceof Error ? error.message : String(error)}</span>{retry && <button onClick={retry}>重试</button>}</div>
}
export function Loading() { return <div className="empty" role="status"><LoaderCircle className="spin" size={22}/><span>正在加载</span></div> }
export function Empty({ title = '暂无记录', detail }: { title?: string; detail?: string }) { return <div className="empty"><span>{title}</span>{detail && <small>{detail}</small>}</div> }
export function Badge({ value }: { value: string }) {
  const labels: Record<string, string> = { active: '正常', inactive: '已停用', maintenance: '维护中', expired: '已过期', quota_exhausted: '额度用尽', open: '待处理', waiting: '等待回复', resolved: '已解决', closed: '已关闭', pending: '待支付', paid: '已支付', completed: '已完成', cancelled: '已取消', canceled: '已取消', failed: '失败', refunded: '已退款' }
  return <span className={`badge badge-${value}`}>{labels[value] || value}</span>
}
export function IconButton({ label, children, onClick, disabled, className = '' }: { label: string; children: ReactNode; onClick: () => unknown; disabled?: boolean; className?: string }) {
  return <button type="button" className={`icon-button ${className}`} title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>
}
export function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false), notice = useNotice()
  useEffect(() => { if (done) { const id = setTimeout(() => setDone(false), 1500); return () => clearTimeout(id) } }, [done])
  return <IconButton label={done ? '已复制' : label} onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true) } catch { notice('无法复制，请选择文本后复制。') } }}>{done ? <Check size={16}/> : <Copy size={16}/>}</IconButton>
}
export function SearchInput({ value, onChange, placeholder = '搜索' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <label className="search"><Search size={16}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}/>{value && <IconButton label="清空搜索" onClick={() => onChange('')}><X size={14}/></IconButton>}</label>
}
export function Pagination({ page, total, size = 20, onChange }: { page: number; total: number; size?: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size))
  return <div className="pagination"><span>共 {total} 条</span><div><IconButton label="上一页" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16}/></IconButton><span>{page} / {pages}</span><IconButton label="下一页" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={16}/></IconButton></div></div>
}
export function Drawer({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close() }, [])
  return <dialog ref={ref} className={`drawer ${wide ? 'wide' : ''}`} onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === e.currentTarget) onClose() }}><div className="drawer-shell"><header><h2>{title}</h2><IconButton label="关闭" onClick={onClose}><X size={19}/></IconButton></header><div className="drawer-body">{children}</div></div></dialog>
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId()
  return <label className="field"><span id={id}>{label}</span>{isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-labelledby': id }) : children}{hint && <small>{hint}</small>}</label>
}
export function KeyValue({ label, children }: { label: string; children: ReactNode }) { return <div className="key-value"><span>{label}</span><div>{children}</div></div> }
