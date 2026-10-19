import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  ExternalLink,
  Filter,
  Gauge,
  GripVertical,
  Infinity as InfinityIcon,
  Layers3,
  LayoutGrid,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import seed from './data/hackathons.json'

const columns = [
  { id: 'discovered', title: 'Discovered', color: 'slate' },
  { id: 'shortlisted', title: 'Shortlisted', color: 'violet' },
  { id: 'approved', title: 'Approved by Judge', color: 'lime' },
  { id: 'building', title: 'Building', color: 'blue' },
  { id: 'submitted', title: 'Submitted', color: 'amber' },
  { id: 'results', title: 'Results', color: 'pink' },
] as const

const checklistLabels = ['Idea', 'Repo', 'MVP', 'Demo video', 'Deck', 'Submission']
type ColumnId = (typeof columns)[number]['id']

function boardStatus(status: string): ColumnId {
  if (status === 'Backlog') return 'discovered'
  return columns.find((column) => column.id === status)?.id ?? 'discovered'
}

type Track = 'web3' | 'ai' | 'both'
type EventFormat = 'online' | 'in-person' | 'hybrid'
type Hackathon = {
  id: string
  name: string
  organizer: string
  track: Track
  prize: string
  startDate: string | null
  deadline: string | null
  rolling: boolean
  format: EventFormat
  location: string | null
  country: string | null
  url: string
  source: string
  description: string | null
  free: boolean | null
  judgeScore: number | null
  judgeIdea: string | null
  status: ColumnId
  notes: string
  checklist: boolean[]
}
type BoardState = { items: Hackathon[] }

const STORAGE_KEY = 'hackathon-hq-board-v3'
const ideaNames = [...new Set(seed.map((item) => item.judgeIdea).filter((idea): idea is string => Boolean(idea)))].sort()
const starterItems = seed.map((item) => ({ ...item, status: boardStatus(item.status), rolling: item.rolling ?? false, judgeScore: item.judgeScore ?? null, judgeIdea: item.judgeIdea ?? null, prize: item.prize || 'TBA', free: item.free ?? null, notes: '', checklist: checklistLabels.map(() => false) })) as Hackathon[]

function loadBoard(): BoardState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { items: starterItems }
    const parsed = JSON.parse(saved) as BoardState
    if (!Array.isArray(parsed.items)) return { items: starterItems }
    // Seed data (hackathons.json) is the source of truth for event facts; only the
    // user's own board state (status, notes, checklist, score edits) and custom cards
    // are restored from storage, so updated or newly added hackathons always show up.
    const savedById = new Map(parsed.items.map((item) => [item.id, item]))
    const seedIds = new Set(starterItems.map((item) => item.id))
    const merged = [
      ...starterItems.map((item) => {
        const saved = savedById.get(item.id)
        return saved ? { ...item, status: saved.status, notes: saved.notes, checklist: saved.checklist, judgeScore: saved.judgeScore } : item
      }),
      ...parsed.items.filter((item) => !seedIds.has(item.id)),
    ]
    return {
      items: merged.map((item) => ({
        ...item,
        status: boardStatus(item.status),
        rolling: Boolean(item.rolling),
        judgeScore: typeof item.judgeScore === 'number' ? item.judgeScore : null,
        judgeIdea: typeof item.judgeIdea === 'string' ? item.judgeIdea : null,
        prize: typeof item.prize === 'string' && item.prize.trim() ? item.prize : 'TBA',
        free: typeof item.free === 'boolean' ? item.free : null,
        notes: typeof item.notes === 'string' ? item.notes : '',
        checklist: checklistLabels.map((_, index) => Boolean(item.checklist?.[index])),
      })),
    }
  } catch {
    return { items: starterItems }
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'TBA'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'TBA'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function daysLeft(value: string | null): number | null {
  if (!value) return null
  const deadline = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(deadline)) return null
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.ceil((deadline - today) / 86400000)
}

// One shared 1s ticker; only <Countdown> subscribes, so cards themselves don't re-render every second.
const clockListeners = new Set<() => void>()
let clockNow = Date.now()
let clockTimer: number | undefined
function subscribeClock(listener: () => void) {
  clockListeners.add(listener)
  if (clockTimer === undefined) {
    clockNow = Date.now()
    clockTimer = window.setInterval(() => { clockNow = Date.now(); clockListeners.forEach((notify) => notify()) }, 1000)
  }
  return () => {
    clockListeners.delete(listener)
    if (clockListeners.size === 0 && clockTimer !== undefined) { window.clearInterval(clockTimer); clockTimer = undefined }
  }
}
function useNow(): number { return useSyncExternalStore(subscribeClock, () => clockNow) }

const URGENT_MS = 72 * 3600 * 1000

// Deadlines are calendar dates; treat them as closing at the end of that day (UTC).
function deadlineMs(value: string | null): number | null {
  if (!value) return null
  const end = Date.parse(`${value}T23:59:59Z`)
  return Number.isNaN(end) ? null : end
}

const pad = (value: number) => String(value).padStart(2, '0')

function Countdown({ deadline, rolling }: { deadline: string | null; rolling: boolean }) {
  const now = useNow()
  if (rolling) return <span className="countdown is-rolling"><InfinityIcon size={12} />Rolling</span>
  const end = deadlineMs(deadline)
  if (end === null) return <span className="countdown is-muted"><Clock3 size={12} />No deadline</span>
  const left = end - now
  if (left <= 0) return <span className="countdown is-closed"><Clock3 size={12} />Closed</span>
  const totalSeconds = Math.floor(left / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const urgent = left < URGENT_MS
  const label = urgent ? `${days * 24 + hours}h ${pad(minutes)}m ${pad(seconds)}s` : `${days}d ${pad(hours)}h ${pad(minutes)}m`
  return <span className={`countdown ${urgent ? 'is-urgent' : ''}`} title={`Closes ${formatDate(deadline)}, 23:59 UTC`}><Clock3 size={12} /><span className="countdown-value">{label}</span></span>
}

const statusFill: Record<ColumnId, number> = { discovered: 0, shortlisted: 0, approved: 0.25, building: 0.5, submitted: 0.75, results: 1 }

function StatusIcon({ id }: { id: ColumnId }) {
  const fill = statusFill[id]
  const circumference = 2 * Math.PI * 2.5
  return (
    <svg className={`status-icon status-${id}`} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={id === 'discovered' ? '1.4 1.75' : undefined} />
      {fill === 1
        ? <path d="M4.4 7.2l1.8 1.8 3.5-3.7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        : fill > 0 && <circle cx="7" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray={`${fill * circumference} ${circumference}`} transform="rotate(-90 7 7)" />}
    </svg>
  )
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const circumference = 2 * Math.PI * 5
  return (
    <span className="progress-chip" title={`${done} of ${total} checklist steps`}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5" className="ring-track" /><circle cx="7" cy="7" r="5" className="ring-value" strokeDasharray={`${(done / total) * circumference} ${circumference}`} transform="rotate(-90 7 7)" /></svg>
      {done}/{total}
    </span>
  )
}

function prize(item: Hackathon): string { return item.prize || 'TBA' }

function formatLabel(format: EventFormat): string {
  return format === 'in-person' ? 'In person' : format === 'hybrid' ? 'Hybrid' : 'Online'
}

function eventPlace(item: Hackathon): string {
  const location = item.location?.trim()
  const country = item.country?.trim()
  if (location && country && !location.toLowerCase().includes(country.toLowerCase())) return `${location}, ${country}`
  return location || country || formatLabel(item.format)
}

function sourceFamily(source: string): 'hacklist.io' | 'hackathons.fun' | 'manual' {
  if (source.startsWith('hacklist.io')) return 'hacklist.io'
  if (source.startsWith('hackathons.fun')) return 'hackathons.fun'
  return 'manual'
}

function prizeUsd(item: Hackathon): number {
  if (/\b(?:USDT|USDC)\b/i.test(item.prize)) return 0
  const amount = item.prize.match(/(?:\bUSD\s*|\$\s*)([\d,]+(?:\.\d+)?)/i)?.[1]
  return amount ? Number(amount.replace(/,/g, '')) || 0 : 0
}

function Badge({ track }: { track: Track }) {
  const label = track === 'both' ? 'Web3 + AI' : track === 'web3' ? 'Web3' : 'AI'
  return <span className={`track-badge ${track}`}>{track === 'web3' ? <Layers3 size={12} /> : track === 'ai' ? <Sparkles size={12} /> : <CircleHelp size={12} />}{label}</span>
}

function HackathonCard({ item, onOpen, dragging = false }: { item: Hackathon; onOpen: (id: string) => void; dragging?: boolean }) {
  const progress = item.checklist.filter(Boolean).length
  return (
    <article className={`hack-card ${dragging ? 'is-dragging' : ''}`} onClick={() => onOpen(item.id)}>
      <div className="card-head">
        <Badge track={item.track} />
        <span className="score-chip" title="Judge score"><Gauge size={12} />{item.judgeScore === null ? '—' : item.judgeScore}</span>
        <a className="card-link" href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.name} official page`} onClick={(event) => event.stopPropagation()}><ArrowUpRight size={14} /></a>
      </div>
      <h3>{item.name}</h3>
      <div className="card-sub"><span>{item.organizer}</span><span className="dot">·</span><span>{eventPlace(item)}</span></div>
      <div className="card-chips">
        <span className="chip prize-chip"><Trophy size={11} />{prize(item)}</span>
        {item.startDate && <span className="chip"><CalendarDays size={11} />{formatDate(item.startDate).replace(/, \d{4}$/, '')}</span>}
        {item.judgeIdea && <span className="chip idea-chip">{item.judgeIdea}</span>}
      </div>
      <div className="card-foot">
        <Countdown deadline={item.deadline} rolling={item.rolling} />
        <ProgressRing done={progress} total={checklistLabels.length} />
      </div>
    </article>
  )
}

function SortableCard({ item, onOpen }: { item: Hackathon; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className={`sortable-wrap ${isDragging ? 'dragging' : ''}`} {...attributes} {...listeners}>
      <HackathonCard item={item} onOpen={onOpen} />
    </div>
  )
}

function BoardColumn({ id, title, color, items, onOpen }: { id: ColumnId; title: string; color: string; items: Hackathon[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${id}` })
  return (
    <section className={`board-column column-${color} ${isOver ? 'column-over' : ''}`} ref={setNodeRef}>
      <div className="column-heading"><StatusIcon id={id} /><h2>{title}</h2><span className="column-count">{items.length}</span></div>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="column-cards">
          {items.map((item) => <SortableCard key={item.id} item={item} onOpen={onOpen} />)}
          {items.length === 0 && <div className="empty-column">Drop a hackathon here</div>}
        </div>
      </SortableContext>
    </section>
  )
}

function DetailDrawer({ item, onClose, onUpdate }: { item: Hackathon; onClose: () => void; onUpdate: (id: string, patch: Partial<Hackathon>) => void }) {
  const completed = item.checklist.filter(Boolean).length
  return (
    <>
      <button className="drawer-backdrop" aria-label="Close details" onClick={onClose} />
      <aside className="detail-drawer" aria-label={`${item.name} details`}>
        <div className="drawer-header"><span>Hackathon details</span><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="drawer-content">
          <div className="drawer-badges"><Badge track={item.track} /><Countdown deadline={item.deadline} rolling={item.rolling} /></div>
          <h2>{item.name}</h2>
          <div className="drawer-organizer">{item.organizer} <span>·</span> {eventPlace(item)}</div>
          <div className="drawer-facts">
            <div><span>Prize pool</span><strong>{prize(item)}</strong></div>
            <div><span>Dates</span><strong>{item.startDate ? `${formatDate(item.startDate)} – ${item.rolling ? 'Rolling' : formatDate(item.deadline)}` : item.rolling ? 'Rolling' : `Deadline ${formatDate(item.deadline)}`}</strong></div>
          </div>
          <section className="drawer-section score-section"><label className="field">Judge score (0–10)<input type="number" min="0" max="10" step="0.5" value={item.judgeScore ?? ''} placeholder="Not scored" onChange={(event) => onUpdate(item.id, { judgeScore: event.target.value === '' ? null : Math.min(10, Math.max(0, Number(event.target.value))) })} /></label>{item.judgeIdea && <div className="drawer-ideas"><span>Judge idea</span><div className="idea-tags"><span>{item.judgeIdea}</span></div></div>}<div className="drawer-ideas"><span>Source</span><div className="source-value">{item.source}</div></div></section>
          <a className="official-link" href={item.url} target="_blank" rel="noreferrer">Open official page <ExternalLink size={15} /></a>
          <section className="drawer-section"><div className="section-title"><div><h3>Build checklist</h3><p>Small steps, shipped one by one.</p></div><span className="check-count">{completed} of {checklistLabels.length}</span></div>
            <div className="checklist">{checklistLabels.map((label, index) => <label key={label} className={`check-item ${item.checklist[index] ? 'checked' : ''}`}><input type="checkbox" checked={item.checklist[index]} onChange={(event) => onUpdate(item.id, { checklist: item.checklist.map((checked, itemIndex) => itemIndex === index ? event.target.checked : checked) })} /><span className="fake-check"><Check size={12} /></span><span>{label}</span></label>)}</div>
          </section>
          <section className="drawer-section"><div className="section-title"><div><h3>Team notes</h3><p>Keep the useful details close.</p></div></div><textarea className="notes-field" value={item.notes} onChange={(event) => onUpdate(item.id, { notes: event.target.value })} placeholder="Ideas, links, judge notes…" /></section>
          <div className="source-note">Listing details are based on the linked event page.</div>
        </div>
      </aside>
    </>
  )
}

function AddHackathonDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (item: Omit<Hackathon, 'status' | 'notes' | 'checklist'>) => void }) {
  const [form, setForm] = useState({ name: '', organizer: '', track: 'ai' as Track, prizeAmount: '', currency: 'USD', startDate: '', deadline: '', mode: 'Online', url: '' })
  const [error, setError] = useState('')
  const change = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }))
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.url.startsWith('https://')) { setError('Enter a secure https:// event link.'); return }
    const location = form.mode.trim() && form.mode.trim().toLowerCase() !== 'online' ? form.mode.trim() : null
    onAdd({ id: `custom-${crypto.randomUUID()}`, name: form.name.trim(), organizer: form.organizer.trim(), track: form.track, prize: form.prizeAmount ? `${form.currency} ${Number(form.prizeAmount).toLocaleString('en-US')}` : 'TBA', startDate: form.startDate || null, deadline: form.deadline || null, rolling: false, format: location ? 'in-person' : 'online', location, country: null, url: form.url.trim(), source: 'manual', description: null, free: null, judgeScore: null, judgeIdea: null })
  }
  return <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="add-dialog" onSubmit={submit}><div className="dialog-header"><div><h2>Add a hackathon</h2><p>Bring the next opportunity onto the board.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
    <div className="form-grid"><label className="field full">Hackathon name<input required value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="e.g. ETHGlobal Mumbai" /></label><label className="field">Organizer / platform<input required value={form.organizer} onChange={(event) => change('organizer', event.target.value)} placeholder="e.g. ETHGlobal" /></label><label className="field">Track<select value={form.track} onChange={(event) => change('track', event.target.value)}><option value="web3">Web3</option><option value="ai">AI</option><option value="both">Web3 + AI</option></select></label>
      <label className="field">Prize pool<input type="number" min="0" value={form.prizeAmount} onChange={(event) => change('prizeAmount', event.target.value)} placeholder="Optional" /></label><label className="field">Currency<select value={form.currency} onChange={(event) => change('currency', event.target.value)}><option>USD</option><option>INR</option><option>EUR</option><option>CAD</option><option>GBP</option></select></label>
      <label className="field">Start date<input type="date" value={form.startDate} onChange={(event) => change('startDate', event.target.value)} /></label><label className="field">End / deadline<input type="date" value={form.deadline} onChange={(event) => change('deadline', event.target.value)} /></label><label className="field">Mode or location<input value={form.mode} onChange={(event) => change('mode', event.target.value)} placeholder="Online or city" /></label><label className="field full">Official event link<input required type="url" value={form.url} onChange={(event) => change('url', event.target.value)} placeholder="https://" /></label></div>
    {error && <div className="form-error">{error}</div>}<div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" type="submit"><Plus size={16} />Add to discovered</button></div></form></div>
}

export default function App() {
  const [board, setBoard] = useState<BoardState>(loadBoard)
  const [search, setSearch] = useState('')
  const [trackFilter, setTrackFilter] = useState<'all' | 'web3' | 'ai'>('all')
  const [formatFilter, setFormatFilter] = useState<'all' | EventFormat>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'hacklist.io' | 'hackathons.fun'>('all')
  const [sortBy, setSortBy] = useState<'soonest' | 'latest' | 'judgeScore'>('judgeScore')
  const [ideaFilter, setIdeaFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 7 } }),
    // Long-press to drag on touch so a normal swipe still scrolls the board and columns.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)) }, [board])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return board.items.filter((item) => {
      const matchesSearch = !query || `${item.name} ${item.organizer} ${item.location ?? ''} ${item.country ?? ''} ${item.source}`.toLowerCase().includes(query)
      const matchesTrack = trackFilter === 'all' || item.track === trackFilter || item.track === 'both'
      const matchesFormat = formatFilter === 'all' || item.format === formatFilter
      const matchesSource = sourceFilter === 'all' || sourceFamily(item.source) === sourceFilter
      const matchesIdea = ideaFilter === 'all' || item.judgeIdea === ideaFilter
      return matchesSearch && matchesTrack && matchesFormat && matchesSource && matchesIdea
    }).sort((left, right) => {
      if (sortBy === 'judgeScore') {
        if (left.judgeScore === null) return right.judgeScore === null ? 0 : 1
        if (right.judgeScore === null) return -1
        return right.judgeScore - left.judgeScore
      }
      // Undated / rolling events always sink to the bottom, whichever direction we sort.
      if (!left.deadline) return right.deadline ? 1 : 0
      if (!right.deadline) return -1
      const leftDate = Date.parse(left.deadline)
      const rightDate = Date.parse(right.deadline)
      return sortBy === 'soonest' ? leftDate - rightDate : rightDate - leftDate
    })
  }, [board.items, search, trackFilter, formatFilter, sourceFilter, ideaFilter, sortBy])

  const selected = board.items.find((item) => item.id === selectedId) ?? null
  const active = board.items.find((item) => item.id === activeId) ?? null
  const activePool = board.items.filter((item) => item.status === 'approved' || item.status === 'building').reduce((sum, item) => sum + prizeUsd(item), 0)
  const next = board.items.filter((item) => !item.rolling && daysLeft(item.deadline) !== null && (daysLeft(item.deadline) ?? -1) >= 0).sort((a, b) => Date.parse(a.deadline ?? '') - Date.parse(b.deadline ?? ''))[0]

  function updateItem(id: string, patch: Partial<Hackathon>) {
    setBoard((current) => ({ items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }))
  }
  function onDragStart(event: DragStartEvent) { setActiveId(String(event.active.id)) }
  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active: dragged, over } = event
    if (!over) return
    const moved = board.items.find((item) => item.id === String(dragged.id))
    if (!moved) return
    const overId = String(over.id)
    const target = overId.startsWith('column-') ? overId.slice(7) : board.items.find((item) => item.id === overId)?.status
    if (target && columns.some((column) => column.id === target) && moved.status !== target) updateItem(moved.id, { status: target as ColumnId })
  }
  function addItem(input: Omit<Hackathon, 'status' | 'notes' | 'checklist'>) {
    setBoard((current) => ({ items: [{ ...input, status: 'discovered', notes: '', checklist: checklistLabels.map(() => false) }, ...current.items] }))
    setShowAdd(false)
  }
  function resetBoard() {
    setBoard({ items: starterItems })
    setSelectedId(null)
  }

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#top"><span className="brand-mark"><Layers3 size={18} strokeWidth={2.2} /></span><span>hackathon<span className="brand-light">hq</span><small>TEAM WORKSPACE</small></span></a>
      <div className="workspace-label">WORKSPACE</div><nav className="side-nav"><button className="nav-item selected"><LayoutGrid size={17} />Board<span className="nav-indicator" /></button></nav>
      <div className="sidebar-bottom"><div className="sidebar-team"><div className="avatar">N</div><div><strong>Nick's team</strong><span>Builder workspace</span></div><ChevronDown size={14} /></div><span className="version">HQ · 1.0.0</span></div>
    </aside>
    <main id="top" className="main-content"><header className="topbar"><div className="breadcrumb"><span className="topbar-mark"><Layers3 size={14} strokeWidth={2.2} /></span>Workspace <span>/</span> <strong>Hackathons</strong></div><div className="top-actions"><span className="online-state"><span />All changes saved</span><button className="avatar small-avatar" title="Nick">N</button></div></header>
      <div className="page-wrap"><section className="page-heading"><div><div className="heading-title"><span className="title-icon"><Sparkles size={20} /></span><h1>Hackathon board</h1></div><p>Every opportunity, one good idea away.</p></div><div className="heading-buttons"><button className="button subtle" onClick={resetBoard}><RotateCcw size={15} />Reset to seed</button><button className="button primary" onClick={() => setShowAdd(true)}><Plus size={17} />Add hackathon</button></div></section>
        <section className="stats-row" aria-label="Board summary"><div className="stat-card total"><div className="stat-icon"><LayoutGrid size={17} /></div><div><span>Total hackathons</span><strong>{board.items.length}</strong></div><small className="stat-extra">on your radar</small></div>
          {columns.map((column) => <div className="stat-card mini" key={column.id}><div className={`stat-dot ${column.color}`} /><span>{column.title === 'Approved by Judge' ? 'Approved' : column.title}</span><strong>{board.items.filter((item) => item.status === column.id).length}</strong></div>)}
          <div className="stat-card prize-stat"><div className="stat-icon gold"><Trophy size={16} /></div><div><span>Approved + building</span><strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(activePool)}</strong></div><small>USD prize pools</small></div>
          <div className="stat-card next-stat"><div className="stat-icon clock"><Clock3 size={16} /></div><div><span>Next deadline</span><strong>{next ? <Countdown deadline={next.deadline} rolling={false} /> : 'None yet'}</strong></div><small>{next ? `${next.name} · ${formatDate(next.deadline)}` : 'Add an opportunity'}</small></div>
        </section>
        <div className="board-toolbar">
          <div className="view-label"><span className="view-mark"><LayoutGrid size={16} /></span><h2>Pipeline</h2><span className="board-total">{filtered.length}</span></div>
          <div className="toolbar-controls">
            <label className="search-field"><Search size={16} /><input aria-label="Search hackathons" placeholder="Search hackathons..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <div className="filter-group" aria-label="Filter track"><Filter size={14} /><button className={trackFilter === 'all' ? 'active' : ''} onClick={() => setTrackFilter('all')}>All</button><button className={trackFilter === 'web3' ? 'active' : ''} onClick={() => setTrackFilter('web3')}>Web3</button><button className={trackFilter === 'ai' ? 'active' : ''} onClick={() => setTrackFilter('ai')}>AI</button></div>
            <div className="filter-group format-filter" aria-label="Filter format"><button className={formatFilter === 'all' ? 'active' : ''} onClick={() => setFormatFilter('all')}>Any</button><button className={formatFilter === 'online' ? 'active' : ''} onClick={() => setFormatFilter('online')}>Online</button><button className={formatFilter === 'in-person' ? 'active' : ''} onClick={() => setFormatFilter('in-person')}>In person</button><button className={formatFilter === 'hybrid' ? 'active' : ''} onClick={() => setFormatFilter('hybrid')}>Hybrid</button></div>
            <label className="select-control"><span>Source</span><select aria-label="Filter by source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}><option value="all">All sources</option><option value="hacklist.io">HackList</option><option value="hackathons.fun">hackathons.fun</option></select></label>
            <label className="select-control"><span>Idea</span><select aria-label="Filter by idea" value={ideaFilter} onChange={(event) => setIdeaFilter(event.target.value)}><option value="all">All ideas</option>{ideaNames.map((idea) => <option key={idea} value={idea}>{idea}</option>)}</select></label>
            <label className="sort-button"><ArrowDownWideNarrow size={15} /><span className="sr-only">Sort by</span><select aria-label="Sort hackathons" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="judgeScore">Judge score · Highest</option><option value="soonest">Deadline · Soonest</option><option value="latest">Deadline · Latest</option></select></label>
          </div>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="board-scroll"><div className="kanban-board">{columns.map((column) => <BoardColumn key={column.id} id={column.id} title={column.title} color={column.color} items={filtered.filter((item) => item.status === column.id)} onOpen={setSelectedId} />)}</div></div>
          <DragOverlay>{active ? <HackathonCard item={active} onOpen={() => undefined} dragging /> : null}</DragOverlay>
        </DndContext>
        <footer className="board-footer"><span><GripVertical size={14} />Drag cards between stages to keep your team in sync.</span><span><SlidersHorizontal size={14} />Board saved automatically</span></footer>
      </div>
    </main>
    {selected && <DetailDrawer item={selected} onClose={() => setSelectedId(null)} onUpdate={updateItem} />}
    {showAdd && <AddHackathonDialog onClose={() => setShowAdd(false)} onAdd={addItem} />}
  </div>
}
