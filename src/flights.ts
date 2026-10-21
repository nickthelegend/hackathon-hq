// Departures-board view of the data. Nothing here is stored: every status, bundle head,
// self-review score and missing key is derived from the seed text and the board state.
import type { HackathonRef, Project } from './Projects'
import { deadlineMs } from './shared'

export type FlightStatus = 'boarding' | 'delayed' | 'ontime' | 'open' | 'scheduled' | 'closed' | 'departed' | 'cancelled'

export const statusLabel: Record<FlightStatus, string> = {
  boarding: 'Boarding',
  delayed: 'Delayed',
  ontime: 'On time',
  open: 'Open',
  scheduled: 'Scheduled',
  closed: 'Gate closed',
  departed: 'Departed',
  cancelled: 'Cancelled',
}

/** One-line rule for each status, shown in the legend so the board explains itself. */
export const statusRule: Record<FlightStatus, string> = {
  boarding: 'A project of ours is aimed here and the deadline is within 7 days',
  delayed: 'Our project is BLOCKED on keys or accounts',
  ontime: 'Our project is aimed here; more than 7 days to go',
  open: 'Rolling deadline',
  scheduled: 'On the radar, no project at this gate yet',
  closed: 'The deadline has passed',
  departed: 'Submitted (board stage Submitted or Results)',
  cancelled: 'Not entering: portfolio piece or one entry per team',
}

export const BOARDING_WINDOW_MS = 7 * 86400 * 1000
const SUBMITTED_STAGES = new Set(['submitted', 'results'])

export type Flight = {
  key: string
  project: Project
  label: string
  hackathonId: string | null
  deadline: string | null
  rolling: boolean
  status: FlightStatus
}

export function shortName(name: string): string { return name.replace(/\s*\(.*\)\s*$/, '').trim() || name }
/** The repo/working name kept in brackets after a brand name, e.g. "Kage (Shielded x402)". */
export function aka(name: string): string | null { return name.match(/\(([^)]+)\)\s*$/)?.[1] ?? null }

export function isNotEntering(project: Project, label: string): boolean {
  const flag = project.flag?.trim() ?? ''
  return /not entered/i.test(label) || /^not entered/i.test(flag) || /^portfolio$/i.test(flag)
}

/** The BLOCKED clause of a next step, without the "(Nick)" owner tag. */
export function blockedText(project: Project): string | null {
  const start = project.nextStep.indexOf('BLOCKED')
  if (start < 0) return null
  const rest = project.nextStep.slice(start).replace(/^BLOCKED:?\s*/, '')
  const cuts = [rest.indexOf(' (Nick)'), rest.indexOf('. ')].filter((index) => index >= 0)
  return (cuts.length ? rest.slice(0, Math.min(...cuts)) : rest).replace(/\.$/, '').trim()
}

/** Environment variable names inside the BLOCKED clause (the exact keys Nick has to provide). */
export function missingKeys(project: Project): string[] {
  const text = blockedText(project)
  return text ? [...new Set(text.match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]*[A-Z0-9]\b/g) ?? [])] : []
}

/** Bundle (or branch) and head commit named in the next step or score note. */
export function bundleHead(project: Project): { bundle: string | null; head: string | null } {
  const fromStep = project.nextStep.match(/([\w.-]+\.bundle) \(([0-9a-f]{7,40})/)
  if (fromStep) return { bundle: fromStep[1], head: fromStep[2] }
  const note = project.scoreNote ?? ''
  const branch = note.match(/\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+) ([0-9a-f]{7})\b/)
  if (branch) return { bundle: branch[1], head: branch[2] }
  const head = `${note} ${project.nextStep}`.match(/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7}\b/)
  return { bundle: null, head: head?.[0] ?? null }
}

/** "Self-review Oct 21 (…): 6 → 7" or "…: 5.5 (before fixes)". */
export function selfReview(project: Project): { before: string; after: string | null; when: string } | null {
  const match = (project.scoreNote ?? '').match(/Self-review ([A-Z][a-z]{2} \d{1,2})[^:]*:\s*(\d+(?:\.\d+)?)(?:\s*→\s*(\d+(?:\.\d+)?))?/)
  return match ? { when: match[1], before: match[2], after: match[3] ?? null } : null
}

export function flightStatus(project: Project, target: { label: string; deadline: string | null; rolling: boolean }, stage: string | undefined, now: number): FlightStatus {
  if (project.status === 'submitted' || (stage && SUBMITTED_STAGES.has(stage))) return 'departed'
  if (isNotEntering(project, target.label)) return 'cancelled'
  const end = target.rolling ? null : deadlineMs(target.deadline)
  if (end !== null && end <= now) return 'closed'
  if (blockedText(project)) return 'delayed'
  if (target.rolling) return 'open'
  if (end === null) return 'scheduled'
  return end - now <= BOARDING_WINDOW_MS ? 'boarding' : 'ontime'
}

const urgency: FlightStatus[] = ['delayed', 'boarding', 'ontime', 'open', 'scheduled', 'closed', 'departed', 'cancelled']

/** A gate with several flights shows the most pressing one; all-cancelled stays cancelled. */
export function combineStatus(statuses: FlightStatus[]): FlightStatus | null {
  if (!statuses.length) return null
  const live: FlightStatus[] = statuses.filter((status) => status !== 'cancelled')
  if (!live.length) return 'cancelled'
  return urgency.find((status) => live.includes(status)) ?? live[0]
}

export function buildFlights(projects: Project[], hackathons: Map<string, HackathonRef>, now: number): Flight[] {
  return projects.flatMap((project) => project.targets.map((target) => {
    const hackathon = target.hackathonId ? hackathons.get(target.hackathonId) : undefined
    const resolved = hackathon
      ? { label: target.label, hackathonId: hackathon.id, deadline: hackathon.deadline, rolling: hackathon.rolling }
      : { label: target.label, hackathonId: null, deadline: target.deadline ?? null, rolling: false }
    return { key: `${project.id}:${resolved.hackathonId ?? resolved.label}`, project, ...resolved, status: flightStatus(project, resolved, hackathon?.status, now) }
  }))
}

/** Flights first by status group (live, then departed, then cancelled), then by deadline. */
export function compareFlights(left: Flight, right: Flight): number {
  const group = (flight: Flight) => flight.status === 'cancelled' ? 3 : flight.status === 'departed' ? 2 : flight.status === 'closed' ? 1 : 0
  if (group(left) !== group(right)) return group(left) - group(right)
  const leftEnd = left.rolling ? null : deadlineMs(left.deadline)
  const rightEnd = right.rolling ? null : deadlineMs(right.deadline)
  if (leftEnd === null) return rightEnd === null ? shortName(left.project.name).localeCompare(shortName(right.project.name)) : 1
  if (rightEnd === null) return -1
  return leftEnd - rightEnd
}
