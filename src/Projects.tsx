import { useMemo, useState, type FormEvent } from 'react'
import { ArrowUpRight, ExternalLink, KeyRound, PlaneTakeoff, Plus, RotateCcw, Search, TicketsPlane, X } from 'lucide-react'
import { type ProjectStatus } from './data/projects'
import { deadlineMs, formatDate, useMinute } from './board'
import { DeadlineClock, FlapCountdown } from './shared'
import { aka, blockedText, buildFlights, bundleHead, compareFlights, missingKeys, selfReview, shortName, type Flight } from './flights'
import { passStatus, projectColumns, resolveTargets, type HackathonRef, type Project } from './store'
import { Barcode, StatusTag } from './StatusTag'

function nextDeadline(targets: { deadline: string | null; rolling: boolean }[], now: number): number | null {
  let best: number | null = null
  for (const target of targets) {
    const end = deadlineMs(target.deadline)
    if (end === null || end <= now || target.rolling) continue
    if (best === null || end < best) best = end
  }
  return best
}

function RouteRow({ flight, onOpenHackathon }: { flight: Flight; onOpenHackathon: (id: string) => void }) {
  return (
    <li className="route-row">
      <span className="route-to">
        <span className="route-label">To</span>
        {flight.hackathonId
          ? <button type="button" className="route-link" onClick={() => onOpenHackathon(flight.hackathonId as string)}>{flight.label}<ArrowUpRight size={12} aria-hidden="true" /></button>
          : <span className="route-name">{flight.label}</span>}
      </span>
      <DeadlineClock deadline={flight.deadline} rolling={flight.rolling} compact />
      <span className="route-left"><FlapCountdown deadline={flight.deadline} rolling={flight.rolling} size="pass" /></span>
      <StatusTag status={flight.status} small />
    </li>
  )
}

function BoardingPass({ project, flights, onOpen, onOpenHackathon }: { project: Project; flights: Flight[]; onOpen: (id: string) => void; onOpenHackathon: (id: string) => void }) {
  const status = passStatus(project, flights)
  const { bundle, head } = bundleHead(project)
  const review = selfReview(project)
  const blocked = blockedText(project)
  const keys = missingKeys(project)
  const stage = projectColumns.find((column) => column.id === project.status)?.title ?? project.status
  const workingName = aka(project.name)
  const name = shortName(project.name)
  return (
    <article className={`pass ${status ? `pass-${status}` : ''}`} aria-labelledby={`pass-${project.id}`}>
      <div className="pass-main">
        <header className="pass-head">
          <span className="pass-kicker"><PlaneTakeoff size={14} aria-hidden="true" />Boarding pass</span>
          {status ? <StatusTag status={status} /> : <span className="pass-nodest">No destination</span>}
        </header>
        <h3 id={`pass-${project.id}`}><button type="button" className="pass-open" onClick={() => onOpen(project.id)}>{name}</button></h3>
        {workingName && <p className="pass-aka">{workingName}</p>}
        {project.pitch && <p className="pass-pitch">{project.pitch}</p>}
        {flights.length
          ? <ul className="pass-route" aria-label="Destinations">{flights.map((flight) => <RouteRow key={flight.key} flight={flight} onOpenHackathon={onOpenHackathon} />)}</ul>
          : <p className="pass-route-empty">Internal: no hackathon target.</p>}
        <dl className="pass-fields">
          <div><dt>Judge score</dt><dd>{project.judgeScore ?? '—'}</dd></div>
          <div><dt>Self-review</dt><dd>{review ? (review.after ? `${review.before} → ${review.after}` : review.before) : '—'}{review && <small>{review.when}{review.after ? ' · after fixes' : /before fixes/.test(project.scoreNote ?? '') ? ' · before fixes' : ''}</small>}</dd></div>
          <div><dt>Progress</dt><dd>{project.progress}%</dd></div>
          <div><dt>Stage</dt><dd>{stage}</dd></div>
        </dl>
        <div className={`pass-keys ${blocked ? 'is-blocked' : ''}`}>
          <span className="pass-label"><KeyRound size={12} aria-hidden="true" />Missing keys</span>
          {blocked
            ? <>{keys.length > 0 && <span className="key-chips">{keys.map((key) => <code key={key}>{key}</code>)}</span>}<span className="key-text">{blocked}</span></>
            : <span className="key-none">None listed</span>}
        </div>
        {project.nextStep && <p className="pass-next"><span className="pass-label">Next step</span>{project.nextStep}</p>}
      </div>
      <div className="pass-stub">
        <div className="stub-field"><span className="pass-label">Gate</span><strong className="stub-gate">{name}</strong></div>
        <div className="stub-field"><span className="pass-label">Bundle · head</span>
          {bundle || head ? <><span className="stub-bundle">{bundle ?? 'no bundle named'}</span><strong className="stub-head">{head ?? '—'}</strong></> : <span className="stub-bundle">None named</span>}
        </div>
        {project.flag && <div className="stub-field"><span className="pass-label">Flag</span><span className="stub-flag">{project.flag}</span></div>}
        {project.repo && <a className="stub-repo" href={project.repo} target="_blank" rel="noreferrer">Repository<ExternalLink size={12} aria-hidden="true" /><span className="sr-only"> for {name} (opens in a new tab)</span></a>}
        <Barcode seed={head ?? project.id} />
      </div>
    </article>
  )
}

type ViewProps = {
  projects: Project[]
  hackathons: HackathonRef[]
  targetFilter: string
  onTargetFilter: (key: string) => void
  onOpenProject: (id: string) => void
  onOpenHackathon: (id: string) => void
  onAdd: () => void
  onReset: () => void
}

export function PassesView({ projects, hackathons, targetFilter, onTargetFilter, onOpenProject, onOpenHackathon, onAdd, onReset }: ViewProps) {
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState<'all' | ProjectStatus>('all')
  const [sortBy, setSortBy] = useState<'deadline' | 'judgeScore' | 'progress'>('deadline')
  const now = useMinute()
  const hackathonMap = useMemo(() => new Map(hackathons.map((item) => [item.id, item])), [hackathons])
  const flightsByProject = useMemo(() => {
    const map = new Map<string, Flight[]>()
    buildFlights(projects, hackathonMap, now).forEach((flight) => map.set(flight.project.id, [...(map.get(flight.project.id) ?? []), flight]))
    map.forEach((flights) => flights.sort(compareFlights))
    return map
  }, [projects, hackathonMap, now])
  const resolved = useMemo(() => new Map(projects.map((project) => [project.id, resolveTargets(project, hackathonMap)])), [projects, hackathonMap])

  const targetOptions = useMemo(() => {
    const options = new Map<string, string>()
    resolved.forEach((targets) => targets.forEach((target) => options.set(target.key, target.label)))
    return [...options].sort((left, right) => left[1].localeCompare(right[1]))
  }, [resolved])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const deadlineOf = (project: Project) => nextDeadline(resolved.get(project.id) ?? [], now)
    return projects.filter((project) => {
      const targets = resolved.get(project.id) ?? []
      const matchesSearch = !query || `${project.name} ${project.pitch} ${project.nextStep} ${project.scoreNote ?? ''} ${targets.map((target) => target.label).join(' ')}`.toLowerCase().includes(query)
      const matchesTarget = targetFilter === 'all' || (targetFilter === 'none' ? targets.length === 0 : targets.some((target) => target.key === targetFilter))
      return matchesSearch && matchesTarget && (stage === 'all' || project.status === stage)
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
  }, [projects, resolved, search, targetFilter, stage, sortBy, now])

  const filtersOn = search.trim() !== '' || targetFilter !== 'all' || stage !== 'all'
  const clearFilters = () => { setSearch(''); setStage('all'); onTargetFilter('all') }

  return <>
    <section className="view-head">
      <div>
        <p className="eyebrow">Boarding passes</p>
        <h1>One pass per project</h1>
        <p className="view-sub">Gate, bundle head, self-review score and the exact keys still missing. Open a pass to edit its stage, progress or notes.</p>
      </div>
      <div className="head-actions"><button type="button" className="button ghost" onClick={onReset}><RotateCcw size={15} aria-hidden="true" />Reset to seed</button><button type="button" className="button amber" onClick={onAdd}><Plus size={16} aria-hidden="true" />Add project</button></div>
    </section>
    <div className="toolbar" role="search">
      <label className="search-field"><Search size={15} aria-hidden="true" /><input aria-label="Search projects" placeholder="Search passes" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className="segmented" role="group" aria-label="Filter by stage">
        <button type="button" aria-pressed={stage === 'all'} onClick={() => setStage('all')}>All<span>{projects.length}</span></button>
        {projectColumns.map((column) => <button type="button" key={column.id} aria-pressed={stage === column.id} onClick={() => setStage(column.id)}>{column.title}<span>{projects.filter((project) => project.status === column.id).length}</span></button>)}
      </div>
      <label className="select-field"><span>Destination</span><select value={targetFilter} onChange={(event) => onTargetFilter(event.target.value)}><option value="all">All destinations</option>{targetOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="none">No destination</option></select></label>
      <label className="select-field"><span>Sort</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="deadline">Next departure</option><option value="judgeScore">Judge score</option><option value="progress">Progress</option></select></label>
    </div>
    <p className="result-line" aria-live="polite">{filtered.length} of {projects.length} passes{filtersOn && <> · <button type="button" className="text-button" onClick={clearFilters}>Clear filters</button></>}</p>
    {filtered.length
      ? <div className="pass-grid">{filtered.map((project) => <BoardingPass key={project.id} project={project} flights={flightsByProject.get(project.id) ?? []} onOpen={onOpenProject} onOpenHackathon={onOpenHackathon} />)}</div>
      : <div className="empty-state"><TicketsPlane size={28} aria-hidden="true" /><h2>{projects.length ? 'No passes match' : 'No passes issued yet'}</h2><p>{projects.length ? 'Nothing matches these filters.' : 'Add a project to issue its first boarding pass.'}</p>{projects.length ? <button type="button" className="button ghost" onClick={clearFilters}>Clear filters</button> : <button type="button" className="button amber" onClick={onAdd}><Plus size={16} aria-hidden="true" />Add project</button>}</div>}
  </>
}

export function ProjectDrawer({ project, hackathons, onClose, onUpdate, onOpenHackathon }: { project: Project; hackathons: HackathonRef[]; onClose: () => void; onUpdate: (id: string, patch: Partial<Project>) => void; onOpenHackathon: (id: string) => void }) {
  const now = useMinute()
  const flights = buildFlights([project], new Map(hackathons.map((item) => [item.id, item])), now).sort(compareFlights)
  const status = passStatus(project, flights)
  return (
    <>
      <button type="button" className="drawer-backdrop" aria-label="Close details" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${project.name} details`}>
        <div className="drawer-bar"><span className="eyebrow">Pass details</span><button type="button" className="icon-button" onClick={onClose} aria-label="Close" autoFocus><X size={18} /></button></div>
        <div className="drawer-body">
          <div className="drawer-tags">{status && <StatusTag status={status} />}{project.flag && <span className="flag-tag">{project.flag}</span>}</div>
          <h2>{project.name}</h2>
          {project.pitch && <p className="drawer-lede">{project.pitch}</p>}
          <section className="drawer-section"><h3>Destinations</h3>
            {flights.length ? <ul className="pass-route is-dark">{flights.map((flight) => <RouteRow key={flight.key} flight={flight} onOpenHackathon={onOpenHackathon} />)}</ul> : <p className="muted">No hackathon target.</p>}
          </section>
          <div className="field-pair">
            <label className="field">Stage<select value={project.status} onChange={(event) => onUpdate(project.id, { status: event.target.value as ProjectStatus })}>{projectColumns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label className="field">Judge score (0–10)<input type="number" min="0" max="10" step="0.5" value={project.judgeScore ?? ''} placeholder="Not scored" onChange={(event) => onUpdate(project.id, { judgeScore: event.target.value === '' ? null : Math.min(10, Math.max(0, Number(event.target.value))) })} /></label>
          </div>
          {project.scoreNote && <section className="drawer-section"><h3>Score note</h3><p className="note-text">{project.scoreNote}</p></section>}
          <section className="drawer-section"><h3>Progress <span className="muted">{project.progress}%</span></h3>
            <input className="range" type="range" min="0" max="100" step="5" value={project.progress} aria-label="Progress percent" style={{ ['--value' as string]: `${project.progress}%` }} onChange={(event) => onUpdate(project.id, { progress: Number(event.target.value) })} />
          </section>
          <label className="field">Next step<textarea rows={3} value={project.nextStep} placeholder="What unblocks this?" onChange={(event) => onUpdate(project.id, { nextStep: event.target.value })} /></label>
          <label className="field">GitHub repo<input type="url" value={project.repo ?? ''} placeholder="https://github.com/…" onChange={(event) => onUpdate(project.id, { repo: event.target.value.trim() || null })} /></label>
          {project.repo?.startsWith('https://') && <a className="out-link" href={project.repo} target="_blank" rel="noreferrer">Open repository <ExternalLink size={14} aria-hidden="true" /></a>}
          <label className="field">Notes<textarea className="notes" value={project.notes} onChange={(event) => onUpdate(project.id, { notes: event.target.value })} placeholder="Links, judge feedback, anything worth remembering" /></label>
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
      progress: form.status === 'submitted' ? 100 : 0,
      repo: repo || null,
      nextStep: form.nextStep.trim(),
      notes: '',
    })
  }
  return <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="add-project-title" onSubmit={submit}><div className="dialog-head"><div><p className="eyebrow">New pass</p><h2 id="add-project-title">Add a project</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
    <div className="form-grid">
      <label className="field full">Project name<input required autoFocus value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="e.g. Blackbox Receipts" /></label>
      <label className="field full">One-line pitch<input value={form.pitch} onChange={(event) => change('pitch', event.target.value)} placeholder="What it does, in one breath" /></label>
      <label className="field full">Destination<select value={form.hackathonId} onChange={(event) => change('hackathonId', event.target.value)}><option value="">None / internal</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}{item.deadline ? ` · ${formatDate(item.deadline)}` : ''}</option>)}</select></label>
      <label className="field">Stage<select value={form.status} onChange={(event) => change('status', event.target.value)}>{projectColumns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="field">Judge score<input type="number" min="0" max="10" step="0.5" value={form.score} onChange={(event) => change('score', event.target.value)} placeholder="Optional" /></label>
      <label className="field full">GitHub repo<input type="url" value={form.repo} onChange={(event) => change('repo', event.target.value)} placeholder="https://github.com/…" /></label>
      <label className="field full">Next step<input value={form.nextStep} onChange={(event) => change('nextStep', event.target.value)} placeholder="Optional" /></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button amber" type="submit"><Plus size={16} aria-hidden="true" />Issue pass</button></div></form></div>
}
