// Board state that is not a component: stages, saved-state loading and saving, target resolution.
import { PROJECTS_SEED_VERSION, projectSeed, type ProjectSeed, type ProjectStatus } from './data/projects'
import { combineStatus, type Flight } from './flights'

export const projectColumns = [
  { id: 'idea', title: 'Idea' },
  { id: 'building', title: 'Building' },
  { id: 'verified', title: 'Verified' },
  { id: 'submitted', title: 'Submitted' },
] as const satisfies readonly { id: ProjectStatus; title: string }[]

export type Project = ProjectSeed & { notes: string }
/** The slice of a hackathon card the projects board needs; App's Hackathon satisfies it. */
export type HackathonRef = { id: string; name: string; deadline: string | null; rolling: boolean; status?: string }
type ResolvedTarget = { key: string; label: string; hackathonId: string | null; deadline: string | null; rolling: boolean }

const PROJECTS_KEY = 'hackathon-hq-projects-v1'
const starterProjects: Project[] = projectSeed.map((item) => ({ ...item, notes: '' }))
const isStatus = (value: unknown): value is ProjectStatus => projectColumns.some((column) => column.id === value)
// Stages retired from the board map onto their nearest current stage so saved cards never vanish.
const legacyStatus: Record<string, ProjectStatus> = { testing: 'verified', done: 'submitted' }
const migrateStatus = (value: unknown): ProjectStatus => isStatus(value) ? value : (typeof value === 'string' && legacyStatus[value]) || 'idea'
const clampProgress = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0

export function loadProjects(): Project[] {
  try {
    const saved = localStorage.getItem(PROJECTS_KEY)
    if (!saved) return starterProjects
    const parsed = JSON.parse(saved) as { version?: number; items?: Project[] }
    if (!Array.isArray(parsed.items)) return starterProjects
    // Same rule as the hackathons board: seed facts win, the user's board state is restored on top.
    const savedById = new Map(parsed.items.map((item) => [item.id, item]))
    const seedIds = new Set(starterProjects.map((item) => item.id))
    const savedVersion = typeof parsed.version === 'number' ? parsed.version : 1
    return [
      ...starterProjects.map((item) => {
        const prev = savedById.get(item.id)
        if (!prev) return item
        // A seed update newer than the saved board resets that card's board fields (repo and notes stay).
        if ((item.seedVersion ?? 0) > savedVersion) return { ...item, repo: prev.repo ?? item.repo, notes: prev.notes }
        return { ...item, status: prev.status, progress: prev.progress, judgeScore: prev.judgeScore, nextStep: prev.nextStep, repo: prev.repo, notes: prev.notes }
      }),
      ...parsed.items.filter((item) => !seedIds.has(item.id) && typeof item.name === 'string'),
    ].map((item) => ({
      ...item,
      status: migrateStatus(item.status),
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
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify({ version: PROJECTS_SEED_VERSION, items })) } catch { /* storage unavailable: board still works for this session */ }
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

/** A project's own status: its most pressing flight; an internal project with no target is Departed once submitted. */
export function passStatus(project: Project, flights: Flight[]) {
  if (!project.targets.length) return project.status === 'submitted' ? 'departed' as const : null
  return combineStatus(flights.map((flight) => flight.status))
}
