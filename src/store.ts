// Board state that is not a component: stages, saved-state loading and saving, target resolution.
//
// Both boards follow one rule: the seed files are the source of truth, and this browser's storage
// keeps only what the user changed. Everything read back from storage is shape-checked, and
// anything malformed is repaired or dropped, so a bad saved value can never blank the page.
import seed from './data/hackathons.json'
import { PROJECTS_SEED_VERSION, projectSeed, type ProjectSeed, type ProjectStatus, type ProjectTarget } from './data/projects'
import { plural, safeHttpsUrl } from './board'
import { combineStatus, type Flight } from './flights'

export const BOARD_KEY = 'hackathon-hq-board-v3'
export const PROJECTS_KEY = 'hackathon-hq-projects-v1'

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown) => typeof value === 'string' ? value : ''
const textOrNull = (value: unknown) => typeof value === 'string' && value.trim() ? value : null
const readScore = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.min(10, Math.max(0, value)) : null

// ---------- Hackathons (Departures) ----------

export const columns = [
  { id: 'discovered', title: 'Discovered' },
  { id: 'shortlisted', title: 'Shortlisted' },
  { id: 'approved', title: 'Approved by Judge' },
  { id: 'building', title: 'Building' },
  { id: 'submitted', title: 'Submitted' },
  { id: 'results', title: 'Results' },
] as const

export const checklistLabels = ['Idea', 'Repo', 'MVP', 'Demo video', 'Deck', 'Submission']
export type ColumnId = (typeof columns)[number]['id']
export type Track = 'web3' | 'ai' | 'both'
export type EventFormat = 'online' | 'in-person' | 'hybrid'
/** Seed fields a user can override from the drawer. Only these, once touched, outrank the seed. */
type EditableField = 'status' | 'judgeScore'
export type Hackathon = {
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
  edited?: EditableField[]
}

const tracks: Track[] = ['web3', 'ai', 'both']
const formats: EventFormat[] = ['online', 'in-person', 'hybrid']

export function boardStatus(status: unknown): ColumnId {
  if (status === 'Backlog') return 'discovered'
  return columns.find((column) => column.id === status)?.id ?? 'discovered'
}
const readChecklist = (value: unknown) => checklistLabels.map((_, index) => Array.isArray(value) && value[index] === true)
const readDate = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value.includes('T') ? value : `${value}T00:00:00Z`)) ? value : null

export const ideaNames = [...new Set(seed.map((item) => item.judgeIdea).filter((idea): idea is string => Boolean(idea)))].sort()
export const starterItems = seed.map((item) => ({ ...item, status: boardStatus(item.status), rolling: item.rolling ?? false, judgeScore: item.judgeScore ?? null, judgeIdea: item.judgeIdea ?? null, prize: item.prize || 'TBA', free: item.free ?? null, notes: '', checklist: checklistLabels.map(() => false), edited: [] })) as Hackathon[]
const seedById = new Map(starterItems.map((item) => [item.id, item]))

/** A custom (user-added) hackathon read back from storage: every field type-checked, or null when unusable. */
function readCustom(raw: unknown): Hackathon | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || seedById.has(raw.id) || !text(raw.name).trim()) return null
  return {
    id: raw.id,
    name: text(raw.name).trim(),
    organizer: text(raw.organizer).trim(),
    track: tracks.includes(raw.track as Track) ? raw.track as Track : 'ai',
    prize: textOrNull(raw.prize) ?? 'TBA',
    startDate: readDate(raw.startDate),
    deadline: readDate(raw.deadline),
    rolling: raw.rolling === true,
    format: formats.includes(raw.format as EventFormat) ? raw.format as EventFormat : 'online',
    location: textOrNull(raw.location),
    country: textOrNull(raw.country),
    url: safeHttpsUrl(raw.url) ?? '',
    source: textOrNull(raw.source) ?? 'manual',
    description: textOrNull(raw.description),
    free: typeof raw.free === 'boolean' ? raw.free : null,
    judgeScore: readScore(raw.judgeScore),
    judgeIdea: textOrNull(raw.judgeIdea),
    status: boardStatus(raw.status),
    notes: text(raw.notes),
    checklist: readChecklist(raw.checklist),
    edited: [],
  }
}

function readCustomList(raw: unknown): Hackathon[] {
  const seen = new Set<string>()
  return (Array.isArray(raw) ? raw : []).map(readCustom).filter((item): item is Hackathon => {
    if (!item || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

type SavedEdit = { status?: ColumnId; judgeScore?: number | null; notes?: string; checklist?: boolean[] }

function applyEdit(item: Hackathon, raw: unknown): Hackathon {
  if (!isRecord(raw)) return item
  const next: Hackathon = { ...item, edited: [] }
  if ('status' in raw) { next.status = boardStatus(raw.status); next.edited!.push('status') }
  if ('judgeScore' in raw) { next.judgeScore = readScore(raw.judgeScore); next.edited!.push('judgeScore') }
  if (typeof raw.notes === 'string') next.notes = raw.notes
  if (Array.isArray(raw.checklist)) next.checklist = readChecklist(raw.checklist)
  return next
}

function applyBoard(edits: unknown, custom: unknown): Hackathon[] {
  const byId = isRecord(edits) ? edits : {}
  return [...starterItems.map((item) => applyEdit(item, byId[item.id])), ...readCustomList(custom)]
}

/**
 * Boards saved before Oct 22 hold a full copy of every card, taken at the first visit. Their
 * scores are snapshots of whatever seed was current then, so the current seed score wins. Notes,
 * ticks and custom cards are the user's. Every seed card has always been Discovered, so a
 * different saved stage is one the user picked and is kept.
 */
function migrateLegacy(items: unknown[]): Hackathon[] {
  const edits: Record<string, SavedEdit> = {}
  const custom: unknown[] = []
  for (const raw of items) {
    if (!isRecord(raw) || typeof raw.id !== 'string') continue
    const seedItem = seedById.get(raw.id)
    if (!seedItem) { custom.push(raw); continue }
    const edit: SavedEdit = {}
    if (typeof raw.notes === 'string' && raw.notes) edit.notes = raw.notes
    if (Array.isArray(raw.checklist) && raw.checklist.some((value) => value === true)) edit.checklist = readChecklist(raw.checklist)
    const status = boardStatus(raw.status)
    if (status !== seedItem.status) edit.status = status
    edits[raw.id] = edit
  }
  return applyBoard(edits, custom)
}

export function loadBoard(): Hackathon[] {
  let parsed: unknown
  try {
    const saved = localStorage.getItem(BOARD_KEY)
    if (!saved) return starterItems
    parsed = JSON.parse(saved)
  } catch {
    return starterItems
  }
  if (!isRecord(parsed)) return starterItems
  if (parsed.format === 2) return applyBoard(parsed.edits, parsed.custom)
  if (Array.isArray(parsed.items)) return migrateLegacy(parsed.items)
  return starterItems
}

/** Only the user's changes: touched stages and scores that differ from the seed, notes, ticks, custom cards. */
export function serializeBoard(items: Hackathon[]): string {
  const edits: Record<string, SavedEdit> = {}
  const custom: Hackathon[] = []
  for (const item of items) {
    const seedItem = seedById.get(item.id)
    if (!seedItem) { custom.push({ ...item, edited: undefined }); continue }
    const edit: SavedEdit = {}
    if (item.edited?.includes('status') && item.status !== seedItem.status) edit.status = item.status
    if (item.edited?.includes('judgeScore') && item.judgeScore !== seedItem.judgeScore) edit.judgeScore = item.judgeScore
    if (item.notes) edit.notes = item.notes
    if (item.checklist.some(Boolean)) edit.checklist = item.checklist
    if (Object.keys(edit).length) edits[item.id] = edit
  }
  return JSON.stringify({ format: 2, edits, custom })
}

/** Writes only when the stored value differs, so two open tabs reloading each other's saves settle at once. */
function write(key: string, json: string) {
  try { if (localStorage.getItem(key) !== json) localStorage.setItem(key, json) } catch { /* storage unavailable: board still works for this session */ }
}

export function saveBoard(items: Hackathon[]) { write(BOARD_KEY, serializeBoard(items)) }

/** A patch from the drawer; stage and score changes are remembered as the user's own. */
export function patchHackathon(item: Hackathon, patch: Partial<Hackathon>): Hackathon {
  const touched = (['status', 'judgeScore'] as const).filter((field) => field in patch)
  return { ...item, ...patch, edited: [...new Set([...(item.edited ?? []), ...touched])] }
}

const phrases = (counts: [number, string, string?][]) => counts.filter(([count]) => count > 0).map(([count, one, many]) => plural(count, one, many))

/** What Reset to seed would throw away on the departures board, as short phrases ("2 team notes"). */
export function boardChanges(items: Hackathon[]): string[] {
  let notes = 0, ticks = 0, stages = 0, scores = 0, custom = 0
  for (const item of items) {
    const seedItem = seedById.get(item.id)
    if (!seedItem) { custom++; continue }
    if (item.notes.trim()) notes++
    ticks += item.checklist.filter(Boolean).length
    if (item.status !== seedItem.status) stages++
    if (item.judgeScore !== seedItem.judgeScore) scores++
  }
  return phrases([[notes, 'team note'], [ticks, 'checklist tick'], [stages, 'stage change'], [scores, 'score edit'], [custom, 'custom hackathon']])
}

// ---------- Projects (Boarding passes) ----------

export const projectColumns = [
  { id: 'idea', title: 'Idea' },
  { id: 'building', title: 'Building' },
  { id: 'verified', title: 'Verified' },
  { id: 'submitted', title: 'Submitted' },
] as const satisfies readonly { id: ProjectStatus; title: string }[]

export type Project = ProjectSeed & { notes: string }
/** The slice of a hackathon card the projects board needs; a Hackathon satisfies it. */
export type HackathonRef = { id: string; name: string; deadline: string | null; rolling: boolean; status?: string }
type ResolvedTarget = { key: string; label: string; hackathonId: string | null; deadline: string | null; rolling: boolean }

const starterProjects: Project[] = projectSeed.map((item) => ({ ...item, notes: '' }))
const isStatus = (value: unknown): value is ProjectStatus => projectColumns.some((column) => column.id === value)
// Stages retired from the board map onto their nearest current stage so saved cards never vanish.
const legacyStatus: Record<string, ProjectStatus> = { testing: 'verified', done: 'submitted' }
const migrateStatus = (value: unknown): ProjectStatus => isStatus(value) ? value : (typeof value === 'string' && legacyStatus[value]) || 'idea'
const clampProgress = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0

function readTarget(raw: unknown): ProjectTarget | null {
  if (!isRecord(raw) || !text(raw.label).trim()) return null
  return { hackathonId: typeof raw.hackathonId === 'string' ? raw.hackathonId : null, label: text(raw.label), deadline: readDate(raw.deadline) }
}

function readCustomProject(raw: Record<string, unknown>): Project | null {
  if (typeof raw.id !== 'string' || !text(raw.name).trim()) return null
  return {
    id: raw.id,
    name: text(raw.name).trim(),
    pitch: text(raw.pitch),
    targets: (Array.isArray(raw.targets) ? raw.targets : []).map(readTarget).filter((target): target is ProjectTarget => target !== null),
    judgeScore: readScore(raw.judgeScore),
    scoreNote: textOrNull(raw.scoreNote) ?? undefined,
    status: migrateStatus(raw.status),
    progress: clampProgress(raw.progress),
    repo: safeHttpsUrl(raw.repo),
    nextStep: text(raw.nextStep),
    flag: textOrNull(raw.flag) ?? undefined,
    notes: text(raw.notes),
  }
}

export function loadProjects(): Project[] {
  let parsed: unknown
  try {
    const saved = localStorage.getItem(PROJECTS_KEY)
    if (!saved) return starterProjects
    parsed = JSON.parse(saved)
  } catch {
    return starterProjects
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.items)) return starterProjects
  const savedItems = parsed.items.filter(isRecord)
  // Seed facts (name, pitch, targets) win; the user's board state is restored on top.
  const savedById = new Map(savedItems.filter((item) => typeof item.id === 'string').map((item) => [item.id as string, item]))
  const seedIds = new Set(starterProjects.map((item) => item.id))
  const savedVersion = typeof parsed.version === 'number' ? parsed.version : 1
  // A stored repo that is not https:// falls back to the seed's; an explicit null (cleared) stays cleared.
  const restoredRepo = (prev: Record<string, unknown>, seedRepo: string | null) => prev.repo === null ? null : safeHttpsUrl(prev.repo) ?? seedRepo
  const seen = new Set<string>()
  return [
    ...starterProjects.map((item) => {
      const prev = savedById.get(item.id)
      if (!prev) return item
      // A seed update newer than the saved board resets that card's board fields (repo and notes stay).
      if ((item.seedVersion ?? 0) > savedVersion) return { ...item, repo: restoredRepo(prev, item.repo), notes: text(prev.notes) }
      return {
        ...item,
        status: migrateStatus(prev.status),
        progress: clampProgress(prev.progress),
        judgeScore: readScore(prev.judgeScore),
        nextStep: text(prev.nextStep),
        repo: restoredRepo(prev, item.repo),
        notes: text(prev.notes),
      }
    }),
    ...savedItems.filter((item) => !seedIds.has(item.id as string)).map(readCustomProject).filter((item): item is Project => {
      if (!item || seen.has(item.id)) return false
      seen.add(item.id)
      return true
    }),
  ]
}

export function saveProjects(items: Project[]) { write(PROJECTS_KEY, JSON.stringify({ version: PROJECTS_SEED_VERSION, items })) }

export function resetProjects(): Project[] { return starterProjects }

/** What Reset to seed would throw away on the passes board. */
export function projectChanges(items: Project[]): string[] {
  const seedProjects = new Map(starterProjects.map((item) => [item.id, item]))
  let notes = 0, edited = 0, custom = 0
  for (const item of items) {
    const seedItem = seedProjects.get(item.id)
    if (!seedItem) { custom++; continue }
    if (item.notes.trim()) notes++
    if (item.status !== seedItem.status || item.progress !== seedItem.progress || item.judgeScore !== seedItem.judgeScore || item.nextStep !== seedItem.nextStep || item.repo !== seedItem.repo) edited++
  }
  return phrases([[notes, 'note'], [edited, 'edited pass', 'edited passes'], [custom, 'custom project']])
}

/** Linked targets take their deadline from the hackathon card, so the countdown always matches the other board. */
export function resolveTargets(project: Project, hackathons: Map<string, HackathonRef>): ResolvedTarget[] {
  return project.targets.map((target) => {
    const hackathon = target.hackathonId ? hackathons.get(target.hackathonId) : undefined
    return hackathon
      ? { key: hackathon.id, label: target.label, hackathonId: hackathon.id, deadline: hackathon.deadline, rolling: hackathon.rolling }
      : { key: `ext:${target.label}`, label: target.label, hackathonId: null, deadline: target.deadline ?? null, rolling: false }
  })
}

/** A project's own status: its most pressing flight; an internal project with no target is Departed once submitted. */
export function passStatus(project: Project, flights: Flight[]) {
  if (!project.targets.length) return project.status === 'submitted' ? 'departed' as const : null
  return combineStatus(flights.map((flight) => flight.status))
}
