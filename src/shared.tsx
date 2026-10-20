import { useSyncExternalStore } from 'react'
import { Clock3, Infinity as InfinityIcon } from 'lucide-react'

export function formatDate(value: string | null): string {
  if (!value) return 'TBA'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'TBA'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
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
export function useNow(): number { return useSyncExternalStore(subscribeClock, () => clockNow) }

const URGENT_MS = 72 * 3600 * 1000

// Deadlines are calendar dates; treat them as closing at the end of that day (UTC).
export function deadlineMs(value: string | null): number | null {
  if (!value) return null
  const end = Date.parse(`${value}T23:59:59Z`)
  return Number.isNaN(end) ? null : end
}

const pad = (value: number) => String(value).padStart(2, '0')

export function Countdown({ deadline, rolling }: { deadline: string | null; rolling: boolean }) {
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

/** Linear-style workflow glyph: dashed ring (backlog), pie fill (in progress), filled check (done). */
export function StatusGlyph({ fill, dashed = false, className }: { fill: number; dashed?: boolean; className: string }) {
  const circumference = 2 * Math.PI * 2.5
  return (
    <svg className={`status-icon ${className}`} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={dashed ? '1.4 1.75' : undefined} />
      {fill === 1
        ? <path d="M4.4 7.2l1.8 1.8 3.5-3.7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        : fill > 0 && <circle cx="7" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray={`${fill * circumference} ${circumference}`} transform="rotate(-90 7 7)" />}
    </svg>
  )
}
