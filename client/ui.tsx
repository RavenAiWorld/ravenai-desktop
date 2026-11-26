import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Inbox,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react'

export const NoticeContext = createContext<(text: string) => void>(() => {})
export const useNotice = () => useContext(NoticeContext)

export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return false
    setBusy(true)
    setError('')
    try {
      await action()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run, setError }
}

export function ErrorMessage({ error, retry }: { error?: unknown; retry?: () => unknown }) {
  if (!error) return null
  return (
    <div className="error" role="alert">
      <AlertCircle size={16} />
      <span>{error instanceof Error ? error.message : String(error)}</span>
      {retry && (
        <button type="button" onClick={retry}>
          重试
        </button>
      )}
    </div>
  )
}

export function Loading({ label = '正在加载' }: { label?: string }) {
  return (
    <div className="empty" role="status">
      <div className="empty-icon">
        <LoaderCircle className="spin" size={19} />
      </div>
      <span>{label}</span>
    </div>
  )
}

export function Empty({ title = '暂无记录', detail, icon }: { title?: string; detail?: string; icon?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon || <Inbox size={19} />}</div>
      <strong>{title}</strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}

const BADGE_LABELS: Record<string, string> = {
  active: '正常',
  inactive: '已停用',
  maintenance: '维护中',
  expired: '已过期',
  quota_exhausted: '额度用尽',
  open: '待处理',
  waiting: '等待回复',
  resolved: '已解决',
  closed: '已关闭',
  pending: '待支付',
  paid: '已支付',
  completed: '已完成',
  cancelled: '已取消',
  canceled: '已取消',
  failed: '失败',
  refunded: '已退款',
  passed: '检测通过',
  suspected: '存在疑点',
  stale: '历史快照',
}

export function Badge({ value }: { value: string }) {
  return <span className={`badge badge-${value}`}>{BADGE_LABELS[value] || value}</span>
}

export function IconButton({
  label,
  children,
  onClick,
  disabled,
  className = '',
}: {
  label: string
  children: ReactNode
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => unknown
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  const notice = useNotice()
  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => setDone(false), 1600)
    return () => clearTimeout(id)
  }, [done])
  return (
    <IconButton
      label={done ? '已复制' : label}
      onClick={async e => {
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          notice('已复制到剪贴板')
        } catch {
          notice('无法复制，请选择文本后复制。')
        }
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
    </IconButton>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = '搜索',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="search">
      <Search size={15} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <IconButton label="清空搜索" onClick={() => onChange('')}>
          <X size={13} />
        </IconButton>
      )}
    </label>
  )
}

export interface SelectOptionItem {
  value: string
  label: string
  description?: string
  meta?: ReactNode
  icon?: ReactNode
  disabled?: boolean
  keywords?: string
}

export function SelectMenu({
  value,
  options,
  onChange,
  placeholder = '请选择',
  ariaLabel,
  searchable = false,
  searchPlaceholder = '搜索选项...',
  disabled = false,
  className = '',
  minWidth,
  emptyText = '暂无可选项',
}: {
  value: string
  options: SelectOptionItem[]
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  searchable?: boolean
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  minWidth?: number
  emptyText?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(
    null,
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const portalHost = useRef<HTMLElement>(document.body)

  const current = options.find(o => o.value === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o =>
      `${o.label} ${o.description || ''} ${o.keywords || ''} ${o.value}`.toLowerCase().includes(q),
    )
  }, [options, query])

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pad = 10
    const width = Math.min(Math.max(rect.width, minWidth || 190), window.innerWidth - pad * 2)
    const left = Math.max(pad, Math.min(rect.left, window.innerWidth - width - pad))
    const below = window.innerHeight - rect.bottom - pad - 6
    const above = rect.top - pad - 6
    const opensAbove = below < 220 && above > below
    const maxHeight = Math.max(140, Math.min(340, opensAbove ? above : below))
    setPos(
      opensAbove
        ? { bottom: Math.max(pad, window.innerHeight - rect.top + 6), left, width, maxHeight }
        : { top: Math.max(pad, rect.bottom + 6), left, width, maxHeight },
    )
  }

  useLayoutEffect(() => {
    if (!open) return
    // Render inside top-layer <dialog> if triggered inside a Drawer so portal isn't behind backdrop!
    const nearestDialog = triggerRef.current?.closest('dialog') as HTMLElement | null
    portalHost.current = nearestDialog || document.body
    updatePosition()
    if (searchable) searchRef.current?.focus()
  }, [open, searchable])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onRelayout = () => updatePosition()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onRelayout)
    window.addEventListener('scroll', onRelayout, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onRelayout)
      window.removeEventListener('scroll', onRelayout, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`select-trigger ${open ? 'open' : ''} ${className}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setQuery('')
          setOpen(v => !v)
        }}
      >
        <span className="select-trigger-content">
          {current?.icon}
          <span className={`select-trigger-label ${!current ? 'placeholder' : ''}`}>
            {current?.label || placeholder}
          </span>
          {current?.meta}
        </span>
        <ChevronDown size={14} className={`select-chevron ${open ? 'open' : ''}`} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="select-popover"
            role="presentation"
            style={{
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
            }}
          >
            {searchable && (
              <div className="select-popover-search">
                <Search size={14} className="muted" />
                <input
                  ref={searchRef}
                  type="text"
                  aria-label={searchPlaceholder}
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="清空筛选"
                    onClick={() => setQuery('')}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
            <div className="select-popover-list" role="listbox" aria-label={ariaLabel || placeholder}>
              {!filtered.length ? (
                <div className="select-popover-empty">{emptyText}</div>
              ) : (
                filtered.map(opt => {
                  const selected = opt.value === value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={opt.disabled}
                      className={`select-popover-option ${selected ? 'selected' : ''}`}
                      onClick={() => {
                        if (opt.disabled) return
                        onChange(opt.value)
                        setOpen(false)
                        setQuery('')
                      }}
                    >
                      {opt.icon && <span className="select-option-icon">{opt.icon}</span>}
                      <span className="select-option-body">
                        <span className="select-option-head">
                          <strong>{opt.label}</strong>
                          {opt.meta}
                        </span>
                        {opt.description && <small>{opt.description}</small>}
                      </span>
                      {selected && <Check size={14} className="select-option-check" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          portalHost.current,
        )}
    </>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <div className="switch-row">
      <div className="switch-meta">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`switch-track ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-thumb" />
      </button>
    </div>
  )
}

export function Pagination({
  page,
  total,
  size = 20,
  onChange,
  onSizeChange,
}: {
  page: number
  total: number
  size?: number
  onChange: (page: number) => void
  onSizeChange?: (size: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  return (
    <div className="pagination">
      <span className="numeric">共 {total} 条记录</span>
      <div>
        {onSizeChange && (
          <SelectMenu
            ariaLabel="每页条数"
            className="compact"
            minWidth={104}
            value={String(size)}
            options={[
              { value: '10', label: '10 条/页' },
              { value: '20', label: '20 条/页' },
              { value: '50', label: '50 条/页' },
            ]}
            onChange={v => onSizeChange(Number(v))}
          />
        )}
        <IconButton label="上一页" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} />
        </IconButton>
        <span className="mono">
          {page} / {pages}
        </span>
        <IconButton label="下一页" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRight size={16} />
        </IconButton>
      </div>
    </div>
  )
}

export function Drawer({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const backdropDown = useRef(false)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  const isOutsideDialog = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = ref.current
    if (!dialog || (e.clientX === 0 && e.clientY === 0)) return false
    const rect = dialog.getBoundingClientRect()
    return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom
  }
  return (
    <dialog
      ref={ref}
      className={`drawer ${wide ? 'wide' : ''}`}
      onCancel={e => {
        e.preventDefault()
        onClose()
      }}
      onMouseDown={e => {
        backdropDown.current = e.target === e.currentTarget && isOutsideDialog(e)
      }}
      onClick={e => {
        const shouldClose = backdropDown.current && e.target === e.currentTarget && isOutsideDialog(e)
        backdropDown.current = false
        if (shouldClose) onClose()
      }}
    >
      <div className="drawer-shell">
        <header>
          <h2>{title}</h2>
          <IconButton label="关闭" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="drawer-body">{children}</div>
      </div>
    </dialog>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId()
  return (
    <label className="field">
      <span id={id}>{label}</span>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-labelledby': id })
        : children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="key-value">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  )
}
