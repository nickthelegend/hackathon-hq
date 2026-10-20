import { useMemo, useState, type FormEvent } from 'react'
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
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDownWideNarrow, ArrowUpRight, Clock3, CornerDownRight, ExternalLink, FolderKanban, Gauge, Github, GripVertical, Lightbulb, Plus, RotateCcw, Search, SlidersHorizontal, Target, X } from 'lucide-react'
import { projectSeed, type ProjectSeed, type ProjectStatus } from './data/projects'
import { Countdown, deadlineMs, formatDate, StatusGlyph } from './shared'

export const projectColumns = [
  { id: 'idea', title: 'Idea', fill: 0, dashed: true },
  { id: 'building', title: 'Building', fill: 0.35, dashed: false },
  { id: 'testing', title: 'Testing', fill: 0.6, dashed: false },
  { id: 'submitted', title: 'Submitted', fill: 0.85, dashed: false },
  { id: 'done', title: 'Won/Done', fill: 1, dashed: false },
] as const satisfies readonly { id: ProjectStatus; title: string; fill: number; dashed: boolean }[]

export type Project = ProjectSeed & { notes: string }
/** The slice of a hackathon card the projects board needs; App's Hackathon satisfies it. */
export type HackathonRef = { id: string; name: string; deadline: string | null; rolling: boolean }
type ResolvedTarget = { key: string; label: string; hackathonId: string | null; deadline: string | null; rolling: boolean }

const PROJECTS_KEY = 'hackathon-hq-projects-v1'
const starterProjects: Project[] = projectSeed.map((item) => ({ ...item, notes: '' }))
const isStatus = (value: unknown): value is ProjectStatus => projectColumns.some((column) => column.id === value)
const clampProgress = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0

export function loadProjects(): Project[] {
  try {
    const saved = localStorage.getItem(PROJECTS_KEY)
    if (!saved) return starterProjects
    const parsed = JSON.parse(saved) as { items?: Project[] }
    if (!Array.isArray(parsed.items)) return starterProjects
    // Same rule as the hackathons board: seed facts win, the user's board state is restored on top.
    const savedById = new Map(parsed.items.map((item) => [item.id, item]))
    const seedIds = new Set(starterProjects.map((item) => item.id))
    return [
      ...starterProjects.map((item) => {
        const prev = savedById.get(item.id)
        return prev ? { ...item, status: prev.status, progress: prev.progress, judgeScore: prev.judgeScore, nextStep: prev.nextStep, repo: prev.repo, notes: prev.notes } : item
      }),
      ...parsed.items.filter((item) => !seedIds.has(item.id) && typeof item.name === 'string'),
    ].map((item) => ({
      ...item,
      status: isStatus(item.status) ? item.status : 'idea',
      progress: clampProgress(item.progress),
      judgeScore: typeof item.judgeScore === 'number' ? item.judgeScore : null,
      nextStep: typeof item.nextStep === 'string' ? item.nextStep : '',
      repo: typeof item.repo === 'string' && item.repo.trim() ? item.repo : null,
      notes: typeof item.notes === 'string' ? item.notes : '',
      pitch: typeof item.pitch === 'string' ? item.pitch : '',
      targets: Array.isArray(item.targets) ? item.targets : [],
    }))
  } catch {
    return starterProjects
  }
}

export function saveProjects(items: Project[]) {
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify({ items })) } catch { /* storage unavailable: board still works for this session */ }
}

export function resetProjects(): Project[] { return starterProjects }

/** Linked targets take their deadline from the hackathon card, so the countdown always matches the other board. */
export function resolveTargets(project: Project, hackathons: Map<string, HackathonRef>): ResolvedTarget[] {
  return project.targets.map((target) => {
    const hackathon = target.hackathonId ? hackathons.get(target.hackathonId) : undefined
    return hackathon
      ? { key: hackathon.id, label: target.label, hackathonId: hackathon.id, deadline: hackathon.deadline, rolling: hackathon.rolling }
      : { key: `ext:${target.label}`, label: target.label, hackathonId: null, deadline: target.deadline ?? null, rolling: false }
  })
}

function nextDeadline(targets: ResolvedTarget[], now: number): ResolvedTarget | null {
  let best: ResolvedTarget | null = null
  for (const target of targets) {
    const end = deadlineMs(target.deadline)
    if (end === null || end <= now || target.rolling) continue
    if (!best || end < (deadlineMs(best.deadline) ?? Infinity)) best = target
  }
  return best
}

function ProgressBar({ value, done }: { value: number; done: boolean }) {
  return (
    <div className={`progress-bar ${done ? 'is-done' : ''}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
      <span className="progress-track"><span className="progress-fill" style={{ width: `${value}%` }} /></span>
      <span className="progress-value">{value}%</span>
    </div>
  )
}

function ScoreChip({ project }: { project: Project }) {
  return (
    <span className="score-chip" title={project.scoreNote ? `Judge score · ${project.scoreNote}` : 'Judge score'}>
      <Gauge size={12} />{project.judgeScore ?? '—'}{project.scoreNote && <span className="score-note">→ {project.scoreNote}</span>}
    </span>
  )
}

function TargetRow({ target, onOpenHackathon }: { target: ResolvedTarget; onOpenHackathon: (id: string) => void }) {
  return (
    <div className="target-row">
      {target.hackathonId
        ? <button type="button" className="target-link" title="Open hackathon card" onClick={(event) => { event.stopPropagation(); onOpenHackathon(target.hackathonId as string) }}><Target size={11} /><span>{target.label}</span><ArrowUpRight size={11} /></button>
        : <span className="target-link is-external" title="Not on the hackathons board yet"><Target size={11} /><span>{target.label}</span></span>}
      <Countdown deadline={target.deadline} rolling={target.rolling} />
    </div>
  )
}

function ProjectCard({ project, targets, onOpen, onOpenHackathon, dragging = false }: { project: Project; targets: ResolvedTarget[]; onOpen: (id: string) => void; onOpenHackathon: (id: string) => void; dragging?: boolean }) {
  return (
    <article className={`hack-card project-card ${dragging ? 'is-dragging' : ''}`} onClick={() => onOpen(project.id)}>
      <div className="card-head">
        <ScoreChip project={project} />
        {project.flag && <span className="flag-chip">{project.flag}</span>}
        {project.repo && <a className="card-link repo-link" href={project.repo} target="_blank" rel="noreferrer" aria-label={`Open ${project.name} repository`} title={project.repo.replace(/^https:\/\//, '')} onClick={(event) => event.stopPropagation()}><Github size={14} /></a>}
      </div>
      <h3>{project.name}</h3>
      {project.pitch && <p className="project-pitch">{project.pitch}</p>}
      <div className="target-list">
        {targets.length ? targets.map((target) => <TargetRow key={target.key} target={target} onOpenHackathon={onOpenHackathon} />) : <span className="target-none">No target hackathon</span>}
      </div>
      <ProgressBar value={project.progress} done={project.status === 'done'} />
      {project.nextStep && <div className="next-step"><CornerDownRight size={12} /><span>{project.nextStep}</span></div>}
    </article>
  )
}

function SortableProject(props: { project: Project; targets: ResolvedTarget[]; onOpen: (id: string) => void; onOpenHackathon: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.project.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`sortable-wrap ${isDragging ? 'dragging' : ''}`} {...attributes} {...listeners}>
      <ProjectCard {...props} />
    </div>
  )
}

function ProjectColumn({ column, items, targetsOf, onOpen, onOpenHackathon }: { column: (typeof projectColumns)[number]; items: Project[]; targetsOf: (project: Project) => ResolvedTarget[]; onOpen: (id: string) => void; onOpenHackathon: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${column.id}` })
  return (
    <section className={`board-column ${isOver ? 'column-over' : ''}`} ref={setNodeRef}>
      <div className="column-heading"><StatusGlyph fill={column.fill} dashed={column.dashed} className={`status-p-${column.id}`} /><h2>{column.title}</h2><span className="column-count">{items.length}</span></div>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="column-cards">
          {items.map((item) => <SortableProject key={item.id} project={item} targets={targetsOf(item)} onOpen={onOpen} onOpenHackathon={onOpenHackathon} />)}
          {items.length === 0 && <div className="empty-column">Drop a project here</div>}
        </div>
      </SortableContext>
    </section>
  )
}

type ViewProps = {
  projects: Project[]
  hackathons: HackathonRef[]
  targetFilter: string
  onTargetFilter: (key: string) => void
  onOpenProject: (id: string) => void
  onOpenHackathon: (id: string) => void
  onUpdate: (id: string, patch: Partial<Project>) => void
  onAdd: () => void
  onReset: () => void
}

export function ProjectsView({ projects, hackathons, targetFilter, onTargetFilter, onOpenProject, onOpenHackathon, onUpdate, onAdd, onReset }: ViewProps) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'judgeScore' | 'deadline' | 'progress'>('judgeScore')
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const hackathonMap = useMemo(() => new Map(hackathons.map((item) => [item.id, item])), [hackathons])
  const resolved = useMemo(() => new Map(projects.map((project) => [project.id, resolveTargets(project, hackathonMap)])), [projects, hackathonMap])
  const targetsOf = (project: Project) => resolved.get(project.id) ?? []
  // Minute resolution is plenty for ordering and "next deadline"; the countdowns themselves tick every second.
  const minute = Math.floor(Date.now() / 60000) * 60000

  const targetOptions = useMemo(() => {
    const options = new Map<string, string>()
    resolved.forEach((targets) => targets.forEach((target) => options.set(target.key, target.label)))
    return [...options].sort((left, right) => left[1].localeCompare(right[1]))
  }, [resolved])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const deadlineOf = (project: Project) => deadlineMs(nextDeadline(resolved.get(project.id) ?? [], minute)?.deadline ?? null)
    return projects.filter((project) => {
      const targets = resolved.get(project.id) ?? []
      const matchesSearch = !query || `${project.name} ${project.pitch} ${project.nextStep} ${targets.map((target) => target.label).join(' ')}`.toLowerCase().includes(query)
      const matchesTarget = targetFilter === 'all' || (targetFilter === 'none' ? targets.length === 0 : targets.some((target) => target.key === targetFilter))
      return matchesSearch && matchesTarget
    }).sort((left, right) => {
      if (sortBy === 'progress') return right.progress - left.progress
      if (sortBy === 'deadline') {
        const leftEnd = deadlineOf(left)
        const rightEnd = deadlineOf(right)
        if (leftEnd === null) return rightEnd === null ? 0 : 1
        if (rightEnd === null) return -1
        return leftEnd - rightEnd
      }
      if (left.judgeScore === null) return right.judgeScore === null ? 0 : 1
      if (right.judgeScore === null) return -1
      return right.judgeScore - left.judgeScore
    })
  }, [projects, resolved, search, targetFilter, sortBy, minute])

  const active = projects.find((project) => project.id === activeId) ?? null
  const avgProgress = projects.length ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length) : 0
  const upcoming = projects
    .filter((project) => project.status !== 'done')
    .map((project) => ({ project, target: nextDeadline(resolved.get(project.id) ?? [], minute) }))
    .filter((entry): entry is { project: Project; target: ResolvedTarget } => entry.target !== null)
    .sort((left, right) => (deadlineMs(left.target.deadline) ?? 0) - (deadlineMs(right.target.deadline) ?? 0))[0]

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active: dragged, over } = event
    if (!over) return
    const moved = projects.find((project) => project.id === String(dragged.id))
    if (!moved) return
    const overId = String(over.id)
    const target = overId.startsWith('column-') ? overId.slice(7) : projects.find((project) => project.id === overId)?.status
    if (isStatus(target) && moved.status !== target) onUpdate(moved.id, { status: target })
  }

  return <>
    <section className="page-heading"><div><div className="heading-title"><span className="title-icon"><Lightbulb size={20} /></span><h1>Ideas &amp; projects</h1></div><p>From first spark to shipped, aimed at a deadline.</p></div><div className="heading-buttons"><button className="button subtle" onClick={onReset}><RotateCcw size={15} />Reset to seed</button><button className="button primary" onClick={onAdd}><Plus size={17} />Add project</button></div></section>
    <section className="stats-row projects-stats" aria-label="Projects summary">
      <div className="stat-card total"><div className="stat-icon"><FolderKanban size={17} /></div><div><span>Projects</span><strong>{projects.length}</strong></div></div>
      {projectColumns.map((column) => <div className="stat-card mini" key={column.id}><div className={`stat-dot p-${column.id}`} /><span>{column.title}</span><strong>{projects.filter((project) => project.status === column.id).length}</strong></div>)}
      <div className="stat-card avg-stat"><div className="stat-icon accent"><Gauge size={16} /></div><div className="avg-body"><span>Avg progress</span><strong>{avgProgress}%</strong><span className="avg-track"><span style={{ width: `${avgProgress}%` }} /></span></div></div>
      <div className="stat-card next-stat"><div className="stat-icon clock"><Clock3 size={16} /></div><div><span>Next deadline</span><strong>{upcoming ? <Countdown deadline={upcoming.target.deadline} rolling={false} /> : 'None yet'}</strong></div><small>{upcoming ? `${upcoming.project.name} → ${upcoming.target.label} · ${formatDate(upcoming.target.deadline)}` : 'No open targets'}</small></div>
    </section>
    <div className="board-toolbar">
      <div className="view-label"><span className="view-mark"><FolderKanban size={16} /></span><h2>Projects</h2><span className="board-total">{filtered.length}</span></div>
      <div className="toolbar-controls">
        <label className="search-field"><Search size={16} /><input aria-label="Search projects" placeholder="Search projects..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="select-control"><span>Target</span><select aria-label="Filter by target hackathon" value={targetFilter} onChange={(event) => onTargetFilter(event.target.value)}><option value="all">All targets</option>{targetOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="none">No target</option></select></label>
        {targetFilter !== 'all' && <button className="button subtle clear-filter" onClick={() => onTargetFilter('all')}><X size={13} />Clear</button>}
        <label className="sort-button"><ArrowDownWideNarrow size={15} /><span className="sr-only">Sort by</span><select aria-label="Sort projects" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="judgeScore">Judge score · Highest</option><option value="deadline">Next deadline · Soonest</option><option value="progress">Progress · Most</option></select></label>
      </div>
    </div>
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(event) => setActiveId(String(event.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="board-scroll"><div className="kanban-board">{projectColumns.map((column) => <ProjectColumn key={column.id} column={column} items={filtered.filter((project) => project.status === column.id)} targetsOf={targetsOf} onOpen={onOpenProject} onOpenHackathon={onOpenHackathon} />)}</div></div>
      <DragOverlay>{active ? <ProjectCard project={active} targets={targetsOf(active)} onOpen={() => undefined} onOpenHackathon={() => undefined} dragging /> : null}</DragOverlay>
    </DndContext>
    <footer className="board-footer"><span><GripVertical size={14} />Drag projects between stages as they move forward.</span><span><SlidersHorizontal size={14} />Board saved automatically</span></footer>
  </>
}

export function ProjectDrawer({ project, hackathons, onClose, onUpdate, onOpenHackathon }: { project: Project; hackathons: HackathonRef[]; onClose: () => void; onUpdate: (id: string, patch: Partial<Project>) => void; onOpenHackathon: (id: string) => void }) {
  const targets = resolveTargets(project, new Map(hackathons.map((item) => [item.id, item])))
  const column = projectColumns.find((item) => item.id === project.status) ?? projectColumns[0]
  return (
    <>
      <button className="drawer-backdrop" aria-label="Close details" onClick={onClose} />
      <aside className="detail-drawer" aria-label={`${project.name} details`}>
        <div className="drawer-header"><span>Project details</span><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="drawer-content">
          <div className="drawer-badges"><span className="stage-badge"><StatusGlyph fill={column.fill} dashed={column.dashed} className={`status-p-${column.id}`} />{column.title}</span>{project.flag && <span className="flag-chip">{project.flag}</span>}</div>
          <h2>{project.name}</h2>
          {project.pitch && <p className="drawer-pitch">{project.pitch}</p>}
          <div className="drawer-facts">
            <label className="field">Stage<select value={project.status} onChange={(event) => onUpdate(project.id, { status: event.target.value as ProjectStatus })}>{projectColumns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label className="field">Judge score (0–10)<input type="number" min="0" max="10" step="0.5" value={project.judgeScore ?? ''} placeholder="Not scored" onChange={(event) => onUpdate(project.id, { judgeScore: event.target.value === '' ? null : Math.min(10, Math.max(0, Number(event.target.value))) })} /></label>
          </div>
          {project.scoreNote && <div className="score-hint">Judge note: {project.scoreNote}</div>}
          <section className="drawer-section"><div className="section-title"><div><h3>Target hackathons</h3><p>Countdowns follow the linked hackathon card.</p></div></div>
            <div className="drawer-targets">{targets.length ? targets.map((target) => <TargetRow key={target.key} target={target} onOpenHackathon={onOpenHackathon} />) : <span className="target-none">No target hackathon</span>}</div>
          </section>
          <section className="drawer-section"><div className="section-title"><div><h3>Progress</h3><p>How close this is to submittable.</p></div><span className="check-count">{project.progress}%</span></div>
            <input className="progress-range" type="range" min="0" max="100" step="5" value={project.progress} aria-label="Progress percent" style={{ ['--value' as string]: `${project.progress}%` }} onChange={(event) => onUpdate(project.id, { progress: Number(event.target.value) })} />
          </section>
          <section className="drawer-section stacked-fields">
            <label className="field">Next step<input value={project.nextStep} placeholder="What unblocks this?" onChange={(event) => onUpdate(project.id, { nextStep: event.target.value })} /></label>
            <label className="field">GitHub repo<input type="url" value={project.repo ?? ''} placeholder="https://github.com/…" onChange={(event) => onUpdate(project.id, { repo: event.target.value.trim() || null })} /></label>
            {project.repo?.startsWith('https://') && <a className="official-link" href={project.repo} target="_blank" rel="noreferrer">Open repository <ExternalLink size={15} /></a>}
          </section>
          <section className="drawer-section"><div className="section-title"><div><h3>Notes</h3><p>Keys, links, judge feedback.</p></div></div><textarea className="notes-field" value={project.notes} onChange={(event) => onUpdate(project.id, { notes: event.target.value })} placeholder="Anything worth remembering…" /></section>
        </div>
      </aside>
    </>
  )
}

export function AddProjectDialog({ hackathons, onClose, onAdd }: { hackathons: HackathonRef[]; onClose: () => void; onAdd: (project: Project) => void }) {
  const [form, setForm] = useState({ name: '', pitch: '', hackathonId: '', status: 'idea' as ProjectStatus, repo: '', score: '', nextStep: '' })
  const [error, setError] = useState('')
  const change = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }))
  // Open hackathons, soonest deadline first, so the likely target is near the top.
  const options = useMemo(() => {
    const now = Date.now()
    return hackathons
      .filter((item) => item.rolling || (deadlineMs(item.deadline) ?? Infinity) > now)
      .sort((left, right) => (deadlineMs(left.deadline) ?? Infinity) - (deadlineMs(right.deadline) ?? Infinity))
  }, [hackathons])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const repo = form.repo.trim()
    if (repo && !repo.startsWith('https://')) { setError('Repo link must start with https://'); return }
    const hackathon = hackathons.find((item) => item.id === form.hackathonId)
    onAdd({
      id: `custom-${crypto.randomUUID()}`,
      name: form.name.trim(),
      pitch: form.pitch.trim(),
      targets: hackathon ? [{ hackathonId: hackathon.id, label: hackathon.name }] : [],
      judgeScore: form.score === '' ? null : Math.min(10, Math.max(0, Number(form.score))),
      status: form.status,
      progress: form.status === 'done' ? 100 : 0,
      repo: repo || null,
      nextStep: form.nextStep.trim(),
      notes: '',
    })
  }
  return <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="add-dialog" onSubmit={submit}><div className="dialog-header"><div><h2>Add a project</h2><p>Capture the idea while it’s fresh.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
    <div className="form-grid">
      <label className="field full">Project name<input required value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="e.g. Blackbox Receipts" /></label>
      <label className="field full">One-line pitch<input value={form.pitch} onChange={(event) => change('pitch', event.target.value)} placeholder="What it does, in one breath" /></label>
      <label className="field full">Target hackathon<select value={form.hackathonId} onChange={(event) => change('hackathonId', event.target.value)}><option value="">None / internal</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}{item.deadline ? ` · ${formatDate(item.deadline)}` : ''}</option>)}</select></label>
      <label className="field">Stage<select value={form.status} onChange={(event) => change('status', event.target.value)}>{projectColumns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="field">Judge score<input type="number" min="0" max="10" step="0.5" value={form.score} onChange={(event) => change('score', event.target.value)} placeholder="Optional" /></label>
      <label className="field full">GitHub repo<input type="url" value={form.repo} onChange={(event) => change('repo', event.target.value)} placeholder="https://github.com/…" /></label>
      <label className="field full">Next step<input value={form.nextStep} onChange={(event) => change('nextStep', event.target.value)} placeholder="Optional" /></label>
    </div>
    {error && <div className="form-error">{error}</div>}<div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" type="submit"><Plus size={16} />Add project</button></div></form></div>
}
