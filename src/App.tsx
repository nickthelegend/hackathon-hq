import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, Check, ExternalLink, Info, PlaneTakeoff, Plus, RotateCcw, Search, TicketsPlane, X } from 'lucide-react'
import seed from './data/hackathons.json'
import { DeadlineClock, deadlineMs, FlapCountdown, formatDate, SplitFlap, useMinute, zoneClock } from './shared'
import { AddProjectDialog, loadProjects, PassesView, ProjectDrawer, projectColumns, resetProjects, saveProjects, type Project } from './Projects'
import { buildFlights, combineStatus, compareFlights, shortName, statusLabel, statusRule, type Flight, type FlightStatus } from './flights'
import { StatusTag } from './StatusTag'

const columns = [
  { id: 'discovered', title: 'Discovered' },
  { id: 'shortlisted', title: 'Shortlisted' },
  { id: 'approved', title: 'Approved by Judge' },
  { id: 'building', title: 'Building' },
  { id: 'submitted', title: 'Submitted' },
  { id: 'results', title: 'Results' },
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
const TAB_KEY = 'hackathon-hq-tab'
type Tab = 'hackathons' | 'projects'
const PAGE = 30

function loadTab(): Tab {
  if (window.location.hash === '#projects') return 'projects'
  if (window.location.hash === '#hackathons') return 'hackathons'
  try { return localStorage.getItem(TAB_KEY) === 'projects' ? 'projects' : 'hackathons' } catch { return 'hackathons' }
}
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

const trackLabel = (track: Track) => track === 'both' ? 'Web3 + AI' : track === 'web3' ? 'Web3' : 'AI'

/** A hackathon row's status: Departed once its stage says so, else its gates' flights, else the clock. */
function hackathonStatus(item: Hackathon, flights: Flight[], now: number): FlightStatus {
  if (item.status === 'submitted' || item.status === 'results') return 'departed'
  const fromFlights = combineStatus(flights.map((flight) => flight.status))
  if (fromFlights) return fromFlights
  if (item.rolling) return 'open'
  const end = deadlineMs(item.deadline)
  if (end !== null && end <= now) return 'closed'
  return 'scheduled'
}

function WorldClock() {
  const now = useMinute()
  const utc = zoneClock(now, 'UTC')
  const ist = zoneClock(now, 'IST')
  return (
    <div className="world-clock">
      <div className="clock"><span className="clock-zone">UTC</span><SplitFlap text={utc.time} size="clock" label={`${utc.time} UTC, ${utc.date}`} /></div>
      <div className="clock"><span className="clock-zone">IST</span><SplitFlap text={ist.time} size="clock" label={`${ist.time} IST, ${ist.date}`} /></div>
    </div>
  )
}

function NextDeparture({ flight, onOpenProject, onOpenHackathon }: { flight: Flight | null; onOpenProject: (id: string) => void; onOpenHackathon: (id: string) => void }) {
  if (!flight) return (
    <section className="next-departure is-empty" aria-label="Next departure">
      <p className="eyebrow">Next departure</p>
      <h1>No flights boarding</h1>
      <p className="view-sub">No project of ours has an open deadline. Give a project a destination from its boarding pass.</p>
    </section>
  )
  return (
    <section className="next-departure" aria-label="Next departure">
      <div className="nd-head"><p className="eyebrow">Next departure</p><StatusTag status={flight.status} /></div>
      <div className="nd-board"><FlapCountdown deadline={flight.deadline} rolling={flight.rolling} size="hero" /></div>
      <div className="nd-meta">
        <div className="nd-field"><span>Destination</span>{flight.hackathonId ? <button type="button" className="nd-link" onClick={() => onOpenHackathon(flight.hackathonId as string)}>{flight.label}<ArrowUpRight size={16} aria-hidden="true" /></button> : <strong>{flight.label}</strong>}</div>
        <div className="nd-field"><span>Gate</span><button type="button" className="nd-link" onClick={() => onOpenProject(flight.project.id)}>{shortName(flight.project.name)}<ArrowUpRight size={16} aria-hidden="true" /></button></div>
        <div className="nd-field"><span>Closes</span><DeadlineClock deadline={flight.deadline} rolling={flight.rolling} /></div>
      </div>
    </section>
  )
}

const summaryOrder: FlightStatus[] = ['boarding', 'delayed', 'ontime', 'closed', 'departed', 'cancelled']

function FlightRow({ flight, index, onOpenProject, onOpenHackathon }: { flight: Flight; index: number; onOpenProject: (id: string) => void; onOpenHackathon: (id: string) => void }) {
  return (
    <li className={`fids-row row-${flight.status}`}>
      <div className="c-time"><DeadlineClock deadline={flight.deadline} rolling={flight.rolling} /></div>
      <div className="c-dest">
        {flight.hackathonId
          ? <button type="button" className="row-link" onClick={() => onOpenHackathon(flight.hackathonId as string)}>{flight.label}</button>
          : <span className="row-title">{flight.label}</span>}
        {flight.project.flag && <span className="row-sub">{flight.project.flag}</span>}
      </div>
      <div className="c-gate"><span className="cell-label">Gate</span><button type="button" className="gate-chip" title={flight.project.name} onClick={() => onOpenProject(flight.project.id)}>{shortName(flight.project.name)}</button></div>
      <div className="c-left"><FlapCountdown deadline={flight.deadline} rolling={flight.rolling} stagger={Math.min(index, 12) * 40} /></div>
      <div className="c-status"><StatusTag status={flight.status} /></div>
    </li>
  )
}

function DepartureRow({ item, status, gates, index, onOpen, onOpenProject }: { item: Hackathon; status: FlightStatus; gates: Project[]; index: number; onOpen: (id: string) => void; onOpenProject: (id: string) => void }) {
  return (
    <li className={`fids-row is-departure row-${status}`}>
      <div className="c-time"><DeadlineClock deadline={item.deadline} rolling={item.rolling} /></div>
      <div className="c-dest">
        <button type="button" className="row-link" onClick={() => onOpen(item.id)}>{item.name}</button>
        <span className="row-sub">{item.organizer} · {eventPlace(item)} · <span className="row-prize">{item.prize}</span></span>
      </div>
      <div className="c-gate"><span className="cell-label">Gate</span>{gates.length ? <span className="gate-list">{gates.map((project) => <button type="button" key={project.id} className="gate-chip" title={project.name} onClick={() => onOpenProject(project.id)}>{shortName(project.name)}</button>)}</span> : <span className="gate-none">No gate</span>}</div>
      <div className="c-score"><span className="cell-label">Score</span>{item.judgeScore ?? '—'}</div>
      <div className="c-left"><FlapCountdown deadline={item.deadline} rolling={item.rolling} stagger={Math.min(index, 12) * 40} /></div>
      <div className="c-status"><StatusTag status={status} /></div>
    </li>
  )
}

function DetailDrawer({ item, status, gates, flights, onClose, onUpdate, onOpenProject }: { item: Hackathon; status: FlightStatus; gates: Project[]; flights: Flight[]; onClose: () => void; onUpdate: (id: string, patch: Partial<Hackathon>) => void; onOpenProject: (id: string) => void }) {
  const completed = item.checklist.filter(Boolean).length
  return (
    <>
      <button type="button" className="drawer-backdrop" aria-label="Close details" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${item.name} details`}>
        <div className="drawer-bar"><span className="eyebrow">Flight details</span><button type="button" className="icon-button" onClick={onClose} aria-label="Close" autoFocus><X size={18} /></button></div>
        <div className="drawer-body">
          <div className="drawer-tags"><StatusTag status={status} /><span className="flag-tag">{trackLabel(item.track)}</span></div>
          <h2>{item.name}</h2>
          <p className="drawer-lede">{item.organizer} · {eventPlace(item)}</p>
          <div className="drawer-board">
            <div><span className="pass-label">Remaining</span><FlapCountdown deadline={item.deadline} rolling={item.rolling} size="pass" /></div>
            <div><span className="pass-label">Closes</span><DeadlineClock deadline={item.deadline} rolling={item.rolling} /></div>
          </div>
          <dl className="drawer-facts">
            <div><dt>Prize pool</dt><dd>{item.prize}</dd></div>
            <div><dt>Dates</dt><dd>{item.startDate ? `${formatDate(item.startDate)} – ${item.rolling ? 'Rolling' : formatDate(item.deadline)}` : item.rolling ? 'Rolling' : `Deadline ${formatDate(item.deadline)}`}</dd></div>
          </dl>
          {item.description && <p className="note-text">{item.description}</p>}
          <a className="out-link" href={item.url} target="_blank" rel="noreferrer">Open official page <ExternalLink size={14} aria-hidden="true" /></a>
          <section className="drawer-section"><h3>Gates <span className="muted">{gates.length}</span></h3>
            {gates.length
              ? <ul className="gate-rows">{gates.map((project) => {
                const projectFlights = flights.filter((flight) => flight.project.id === project.id)
                const projectStatus = combineStatus(projectFlights.map((flight) => flight.status))
                return <li key={project.id}><button type="button" className="gate-row" onClick={() => onOpenProject(project.id)}><span className="gate-name">{shortName(project.name)}</span><span className="muted">{projectColumns.find((column) => column.id === project.status)?.title} · {project.progress}%</span>{projectStatus && <StatusTag status={projectStatus} small />}<ArrowUpRight size={13} aria-hidden="true" /></button></li>
              })}</ul>
              : <p className="muted">No project at this gate. Add one from Boarding passes.</p>}
          </section>
          <div className="field-pair">
            <label className="field">Board stage<select value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value as ColumnId })}>{columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</select></label>
            <label className="field">Judge score (0–10)<input type="number" min="0" max="10" step="0.5" value={item.judgeScore ?? ''} placeholder="Not scored" onChange={(event) => onUpdate(item.id, { judgeScore: event.target.value === '' ? null : Math.min(10, Math.max(0, Number(event.target.value))) })} /></label>
          </div>
          <dl className="drawer-facts">
            {item.judgeIdea && <div><dt>Judge idea</dt><dd>{item.judgeIdea}</dd></div>}
            <div><dt>Source</dt><dd className="mono-text">{item.source}</dd></div>
          </dl>
          <section className="drawer-section"><h3>Build checklist <span className="muted">{completed} of {checklistLabels.length}</span></h3>
            <div className="checklist">{checklistLabels.map((label, index) => <label key={label} className={`check-item ${item.checklist[index] ? 'checked' : ''}`}><input type="checkbox" checked={item.checklist[index]} onChange={(event) => onUpdate(item.id, { checklist: item.checklist.map((checked, itemIndex) => itemIndex === index ? event.target.checked : checked) })} /><span className="check-box" aria-hidden="true"><Check size={12} /></span><span>{label}</span></label>)}</div>
          </section>
          <label className="field">Team notes<textarea className="notes" value={item.notes} onChange={(event) => onUpdate(item.id, { notes: event.target.value })} placeholder="Ideas, links, judge notes" /></label>
          <p className="muted small">Listing details come from the linked event page.</p>
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
  return <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="add-hackathon-title" onSubmit={submit}><div className="dialog-head"><div><p className="eyebrow">New departure</p><h2 id="add-hackathon-title">Add a hackathon</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
    <div className="form-grid"><label className="field full">Hackathon name<input required autoFocus value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="e.g. ETHGlobal Mumbai" /></label><label className="field">Organizer / platform<input required value={form.organizer} onChange={(event) => change('organizer', event.target.value)} placeholder="e.g. ETHGlobal" /></label><label className="field">Track<select value={form.track} onChange={(event) => change('track', event.target.value)}><option value="web3">Web3</option><option value="ai">AI</option><option value="both">Web3 + AI</option></select></label>
      <label className="field">Prize pool<input type="number" min="0" value={form.prizeAmount} onChange={(event) => change('prizeAmount', event.target.value)} placeholder="Optional" /></label><label className="field">Currency<select value={form.currency} onChange={(event) => change('currency', event.target.value)}><option>USD</option><option>INR</option><option>EUR</option><option>CAD</option><option>GBP</option></select></label>
      <label className="field">Start date<input type="date" value={form.startDate} onChange={(event) => change('startDate', event.target.value)} /></label><label className="field">End / deadline<input type="date" value={form.deadline} onChange={(event) => change('deadline', event.target.value)} /></label><label className="field">Mode or location<input value={form.mode} onChange={(event) => change('mode', event.target.value)} placeholder="Online or city" /></label><label className="field full">Official event link<input required type="url" value={form.url} onChange={(event) => change('url', event.target.value)} placeholder="https://" /></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button amber" type="submit"><Plus size={16} aria-hidden="true" />Add to departures</button></div></form></div>
}

export default function App() {
  const [board, setBoard] = useState<BoardState>(loadBoard)
  const [search, setSearch] = useState('')
  const [trackFilter, setTrackFilter] = useState<'all' | 'web3' | 'ai'>('all')
  const [formatFilter, setFormatFilter] = useState<'all' | EventFormat>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'hacklist.io' | 'hackathons.fun'>('all')
  const [stageFilter, setStageFilter] = useState<'all' | ColumnId>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | FlightStatus>('all')
  const [sortBy, setSortBy] = useState<'soonest' | 'latest' | 'judgeScore'>('soonest')
  const [ideaFilter, setIdeaFilter] = useState('all')
  const [showClosed, setShowClosed] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [tab, setTab] = useState<Tab>(loadTab)
  const [projects, setProjects] = useState<Project[]>(loadProjects)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showAddProject, setShowAddProject] = useState(false)
  const [projectTarget, setProjectTarget] = useState('all')
  const now = useMinute()
  // The control that opened the first drawer or dialog gets focus back when they have all closed.
  const opener = useRef<HTMLElement | null>(null)
  const overlayOpen = selectedId !== null || selectedProjectId !== null || showAdd || showAddProject
  function noteOpener() {
    if (!overlayOpen && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) opener.current = document.activeElement
  }
  useEffect(() => {
    if (overlayOpen) return
    const element = opener.current
    opener.current = null
    if (element?.isConnected) element.focus()
  }, [overlayOpen])

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)) } catch { /* storage unavailable: board still works for this session */ } }, [board])
  useEffect(() => { saveProjects(projects) }, [projects])
  useEffect(() => { try { localStorage.setItem(TAB_KEY, tab) } catch { /* tab memory is a convenience */ } }, [tab])
  useEffect(() => {
    // Back/forward and typed #projects / #hackathons links switch boards too.
    function onHash() {
      if (window.location.hash === '#projects' || window.location.hash === '#hackathons') setTab(loadTab())
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (showAdd) setShowAdd(false)
      else if (showAddProject) setShowAddProject(false)
      else if (selectedProjectId) setSelectedProjectId(null)
      else if (selectedId) setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showAdd, showAddProject, selectedProjectId, selectedId])

  const hackathonMap = useMemo(() => new Map(board.items.map((item) => [item.id, item])), [board.items])
  const flights = useMemo(() => buildFlights(projects, hackathonMap, now).sort(compareFlights), [projects, hackathonMap, now])
  const flightsByHackathon = useMemo(() => {
    const map = new Map<string, Flight[]>()
    flights.forEach((flight) => { if (flight.hackathonId) map.set(flight.hackathonId, [...(map.get(flight.hackathonId) ?? []), flight]) })
    return map
  }, [flights])
  const gatesFor = (id: string) => [...new Map((flightsByHackathon.get(id) ?? []).map((flight) => [flight.project.id, flight.project])).values()]
  const statuses = useMemo(() => new Map(board.items.map((item) => [item.id, hackathonStatus(item, flightsByHackathon.get(item.id) ?? [], now)])), [board.items, flightsByHackathon, now])

  const nextFlight = flights
    .filter((flight) => (flight.status === 'boarding' || flight.status === 'delayed' || flight.status === 'ontime') && !flight.rolling)
    .sort((left, right) => (deadlineMs(left.deadline) ?? Infinity) - (deadlineMs(right.deadline) ?? Infinity))[0] ?? null
  const visibleFlights = statusFilter === 'all' ? flights : flights.filter((flight) => flight.status === statusFilter)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return board.items.filter((item) => {
      const status = statuses.get(item.id) ?? 'scheduled'
      const matchesSearch = !query || `${item.name} ${item.organizer} ${item.location ?? ''} ${item.country ?? ''} ${item.source}`.toLowerCase().includes(query)
      const matchesTrack = trackFilter === 'all' || item.track === trackFilter || item.track === 'both'
      const matchesFormat = formatFilter === 'all' || item.format === formatFilter
      const matchesSource = sourceFilter === 'all' || sourceFamily(item.source) === sourceFilter
      const matchesIdea = ideaFilter === 'all' || item.judgeIdea === ideaFilter
      const matchesStage = stageFilter === 'all' || item.status === stageFilter
      const matchesStatus = statusFilter === 'all' ? (showClosed || status !== 'closed') : status === statusFilter
      return matchesSearch && matchesTrack && matchesFormat && matchesSource && matchesIdea && matchesStage && matchesStatus
    }).sort((left, right) => {
      if (sortBy === 'judgeScore') {
        if (left.judgeScore === null) return right.judgeScore === null ? 0 : 1
        if (right.judgeScore === null) return -1
        return right.judgeScore - left.judgeScore
      }
      // Undated / rolling events always sink to the bottom, whichever direction we sort.
      const leftEnd = left.rolling ? null : deadlineMs(left.deadline)
      const rightEnd = right.rolling ? null : deadlineMs(right.deadline)
      if (leftEnd === null) return rightEnd === null ? 0 : 1
      if (rightEnd === null) return -1
      return sortBy === 'soonest' ? leftEnd - rightEnd : rightEnd - leftEnd
    })
  }, [board.items, statuses, search, trackFilter, formatFilter, sourceFilter, ideaFilter, stageFilter, statusFilter, showClosed, sortBy])

  const closedHidden = statusFilter === 'all' && !showClosed ? board.items.filter((item) => statuses.get(item.id) === 'closed').length : 0
  const filtersOn = search.trim() !== '' || trackFilter !== 'all' || formatFilter !== 'all' || sourceFilter !== 'all' || ideaFilter !== 'all' || stageFilter !== 'all' || statusFilter !== 'all'
  function clearFilters() {
    setSearch(''); setTrackFilter('all'); setFormatFilter('all'); setSourceFilter('all'); setIdeaFilter('all'); setStageFilter('all'); setStatusFilter('all'); setLimit(PAGE)
  }
  const selected = board.items.find((item) => item.id === selectedId) ?? null

  function updateItem(id: string, patch: Partial<Hackathon>) {
    setBoard((current) => ({ items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }))
  }
  function addItem(input: Omit<Hackathon, 'status' | 'notes' | 'checklist'>) {
    setBoard((current) => ({ items: [{ ...input, status: 'discovered', notes: '', checklist: checklistLabels.map(() => false) }, ...current.items] }))
    setShowAdd(false)
  }
  function resetBoard() {
    setBoard({ items: starterItems })
    setSelectedId(null)
  }
  function updateProject(id: string, patch: Partial<Project>) {
    setProjects((current) => current.map((project) => project.id === id ? { ...project, ...patch } : project))
  }
  function addProject(project: Project) {
    setProjects((current) => [project, ...current])
    setShowAddProject(false)
  }
  function openProject(id: string) {
    noteOpener()
    setSelectedId(null)
    setSelectedProjectId(id)
  }
  function openHackathon(id: string) {
    noteOpener()
    setSelectedProjectId(null)
    setSelectedId(id)
  }

  function openAdd() {
    noteOpener()
    setShowAdd(true)
  }
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const tabs = [
    { id: 'hackathons' as const, label: 'Departures', icon: <PlaneTakeoff size={15} aria-hidden="true" />, count: board.items.length },
    { id: 'projects' as const, label: 'Boarding passes', icon: <TicketsPlane size={15} aria-hidden="true" />, count: projects.length },
  ]
  const statusCounts = new Map<FlightStatus, number>()
  flights.forEach((flight) => statusCounts.set(flight.status, (statusCounts.get(flight.status) ?? 0) + 1))
  const visible = filtered.slice(0, limit)

  return <div className="app">
    <a className="skip-link" href="#main">Skip to board</a>
    <header className="topbar">
      <div className="brand" aria-label="Hackathon HQ"><span className="brand-mark" aria-hidden="true">HQ</span><span className="brand-word">Hackathon HQ<small>Departures · Nick's team</small></span></div>
      <nav className="tabs" aria-label="Boards">{tabs.map((item) => <a key={item.id} href={`#${item.id}`} className="tab" aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}>{item.icon}<span>{item.label}</span><span className="tab-count">{item.count}</span></a>)}</nav>
      <WorldClock />
    </header>
    <main id="main" className="page">
      {tab === 'projects'
        ? <PassesView projects={projects} hackathons={board.items} targetFilter={projectTarget} onTargetFilter={setProjectTarget} onOpenProject={openProject} onOpenHackathon={openHackathon} onAdd={() => { noteOpener(); setShowAddProject(true) }} onReset={() => { setProjects(resetProjects()); setSelectedProjectId(null) }} />
        : <>
          <NextDeparture flight={nextFlight} onOpenProject={openProject} onOpenHackathon={openHackathon} />
          <section className="board" aria-labelledby="our-flights">
            <div className="board-head">
              <div><h2 id="our-flights">Our flights</h2><p className="board-sub">Every project × deadline pair. Gate = our project.</p></div>
              <div className="status-filter" role="group" aria-label="Filter by status">
                <button type="button" aria-pressed={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All<span>{flights.length}</span></button>
                {summaryOrder.filter((status) => statusCounts.get(status) || statusFilter === status).map((status) => <button type="button" key={status} className={`sf-${status}`} aria-pressed={statusFilter === status} onClick={() => { setStatusFilter(statusFilter === status ? 'all' : status); setLimit(PAGE) }}><span className="st-lamp" aria-hidden="true" />{statusLabel[status]}<span>{statusCounts.get(status) ?? 0}</span></button>)}
              </div>
            </div>
            <div className="fids" role="region" aria-label="Our flights board">
              <div className="fids-cols" aria-hidden="true"><span>Closes</span><span>Destination</span><span>Gate</span><span>Remaining</span><span>Status</span></div>
              {visibleFlights.length
                ? <ol className="fids-list">{visibleFlights.map((flight, index) => <FlightRow key={flight.key} flight={flight} index={index} onOpenProject={openProject} onOpenHackathon={openHackathon} />)}</ol>
                : <div className="empty-state is-board"><PlaneTakeoff size={24} aria-hidden="true" /><h3>{flights.length ? `No ${statusLabel[statusFilter as FlightStatus].toLowerCase()} flights` : 'No flights scheduled'}</h3><p>{flights.length ? 'Pick another status above.' : 'Give a project a destination from its boarding pass.'}</p></div>}
            </div>
            <details className="legend"><summary><Info size={14} aria-hidden="true" />How statuses are set</summary>
              <ul>{(Object.keys(statusLabel) as FlightStatus[]).map((status) => <li key={status}><StatusTag status={status} small /><span>{statusRule[status]}</span></li>)}</ul>
              <p className="muted small">Computed from the seed data and this browser's board, never stored. Date-only deadlines close at 23:59 UTC.</p>
            </details>
          </section>

          <section className="board" aria-labelledby="all-departures">
            <div className="board-head">
              <div><h2 id="all-departures">All departures</h2><p className="board-sub">{board.items.length} hackathons on the radar, soonest first.</p></div>
              <div className="head-actions"><button type="button" className="button ghost" onClick={resetBoard}><RotateCcw size={15} aria-hidden="true" />Reset to seed</button><button type="button" className="button amber" onClick={openAdd}><Plus size={16} aria-hidden="true" />Add hackathon</button></div>
            </div>
            <div className="toolbar" role="search">
              <label className="search-field"><Search size={15} aria-hidden="true" /><input aria-label="Search hackathons" placeholder="Search destinations" value={search} onChange={(event) => { setSearch(event.target.value); setLimit(PAGE) }} /></label>
              <div className="segmented" role="group" aria-label="Filter by track">{(['all', 'web3', 'ai'] as const).map((value) => <button type="button" key={value} aria-pressed={trackFilter === value} onClick={() => { setTrackFilter(value); setLimit(PAGE) }}>{value === 'all' ? 'All' : value === 'web3' ? 'Web3' : 'AI'}</button>)}</div>
              <label className="select-field"><span>Format</span><select value={formatFilter} onChange={(event) => { setFormatFilter(event.target.value as typeof formatFilter); setLimit(PAGE) }}><option value="all">Any</option><option value="online">Online</option><option value="in-person">In person</option><option value="hybrid">Hybrid</option></select></label>
              <label className="select-field"><span>Source</span><select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value as typeof sourceFilter); setLimit(PAGE) }}><option value="all">All</option><option value="hacklist.io">HackList</option><option value="hackathons.fun">hackathons.fun</option></select></label>
              <label className="select-field"><span>Idea</span><select value={ideaFilter} onChange={(event) => { setIdeaFilter(event.target.value); setLimit(PAGE) }}><option value="all">All</option>{ideaNames.map((idea) => <option key={idea} value={idea}>{idea}</option>)}</select></label>
              <label className="select-field"><span>Stage</span><select value={stageFilter} onChange={(event) => { setStageFilter(event.target.value as typeof stageFilter); setLimit(PAGE) }}><option value="all">All</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</select></label>
              <label className="select-field"><span>Sort</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="soonest">Closes soonest</option><option value="latest">Closes latest</option><option value="judgeScore">Judge score</option></select></label>
            </div>
            <p className="result-line" aria-live="polite">
              Showing {visible.length} of {filtered.length}{statusFilter !== 'all' && <> · {statusLabel[statusFilter]} only</>}
              {closedHidden > 0 && <> · {closedHidden} closed hidden · <button type="button" className="text-button" onClick={() => setShowClosed(true)}>Show closed</button></>}
              {showClosed && statusFilter === 'all' && <> · <button type="button" className="text-button" onClick={() => setShowClosed(false)}>Hide closed</button></>}
              {filtersOn && <> · <button type="button" className="text-button" onClick={clearFilters}>Clear filters</button></>}
            </p>
            <div className="fids" role="region" aria-label="All departures board">
              <div className="fids-cols is-departure" aria-hidden="true"><span>Closes</span><span>Destination</span><span>Gate</span><span>Score</span><span>Remaining</span><span>Status</span></div>
              {visible.length
                ? <ol className="fids-list">{visible.map((item, index) => <DepartureRow key={item.id} item={item} status={statuses.get(item.id) ?? 'scheduled'} gates={gatesFor(item.id)} index={index} onOpen={openHackathon} onOpenProject={openProject} />)}</ol>
                : <div className="empty-state is-board"><Search size={24} aria-hidden="true" /><h3>No departures match</h3><p>{board.items.length ? 'Nothing on the board fits these filters.' : 'The board is empty. Add a hackathon to start.'}</p>{filtersOn ? <button type="button" className="button ghost" onClick={clearFilters}>Clear filters</button> : <button type="button" className="button amber" onClick={openAdd}><Plus size={16} aria-hidden="true" />Add hackathon</button>}</div>}
            </div>
            {filtered.length > visible.length && <button type="button" className="button ghost more" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, filtered.length - visible.length)} more departures<span className="muted"> ({filtered.length - visible.length} left)</span></button>}
          </section>
        </>}
      <footer className="foot"><span>Board saved in this browser.</span><span>Times in UTC and IST (UTC+5:30).</span></footer>
    </main>
    {selected && <DetailDrawer item={selected} status={statuses.get(selected.id) ?? 'scheduled'} gates={gatesFor(selected.id)} flights={flightsByHackathon.get(selected.id) ?? []} onClose={() => setSelectedId(null)} onUpdate={updateItem} onOpenProject={openProject} />}
    {selectedProject && <ProjectDrawer project={selectedProject} hackathons={board.items} onClose={() => setSelectedProjectId(null)} onUpdate={updateProject} onOpenHackathon={openHackathon} />}
    {showAdd && <AddHackathonDialog onClose={() => setShowAdd(false)} onAdd={addItem} />}
    {showAddProject && <AddProjectDialog hackathons={board.items} onClose={() => setShowAddProject(false)} onAdd={addProject} />}
  </div>
}
