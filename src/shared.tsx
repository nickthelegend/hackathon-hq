import { useState, useSyncExternalStore } from 'react'

export function formatDate(value: string | null): string {
  if (!value) return 'TBA'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'TBA'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

// One shared 1s ticker. Components subscribe through a snapshot (minute or second), so a
// countdown only re-renders when the unit it shows actually changes.
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
/** Current time floored to the minute; re-renders once a minute. */
export function useMinute(): number { return useSyncExternalStore(subscribeClock, () => Math.floor(clockNow / 60000) * 60000) }

const motionQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
function subscribeMotion(listener: () => void) {
  motionQuery?.addEventListener('change', listener)
  return () => motionQuery?.removeEventListener('change', listener)
}
export function useReducedMotion(): boolean { return useSyncExternalStore(subscribeMotion, () => Boolean(motionQuery?.matches)) }

// Deadlines are calendar dates; treat them as closing at the end of that day (UTC).
export function deadlineMs(value: string | null | undefined): number | null {
  if (!value) return null
  const end = Date.parse(value.includes('T') ? value : `${value}T23:59:59Z`)
  return Number.isNaN(end) ? null : end
}

const pad = (value: number) => String(value).padStart(2, '0')

const zoneFormats = {
  UTC: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
  IST: new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
}
/** "23:59" and "Oct 28" for a moment in UTC or IST. */
export function zoneClock(ms: number, zone: keyof typeof zoneFormats): { time: string; date: string } {
  const parts = Object.fromEntries(zoneFormats[zone].formatToParts(new Date(ms)).map((part) => [part.type, part.value]))
  return { time: `${parts.hour}:${parts.minute}`, date: `${parts.month} ${parts.day}` }
}

/** Remaining time as flap groups, minute resolution: 06d 08h 23m. */
export function remaining(end: number, now: number): { days: string; hours: string; minutes: string; spoken: string } {
  const totalMinutes = Math.max(0, Math.floor((end - now) / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  return { days: pad(days), hours: pad(hours), minutes: pad(minutes), spoken: `${days} days ${hours} hours ${minutes} minutes left` }
}

/**
 * One split-flap character. When the character changes, the old top leaf falls away and the
 * new bottom leaf lands (the page's one animation). On mount it flips in from blank, staggered
 * by `delay`. With reduced motion it renders the character statically.
 */
function Flap({ char, delay }: { char: string; delay: number }) {
  const reduced = useReducedMotion()
  const [state, setState] = useState({ cur: char, prev: ' ', flips: 1 })
  if (state.cur !== char) setState({ cur: char, prev: state.cur, flips: state.flips + 1 })
  const { cur, prev, flips } = state
  return (
    <span className="flap" style={{ ['--flap-delay' as string]: `${delay}ms` }}>
      <span className="flap-half flap-top"><span>{cur}</span></span>
      <span className="flap-half flap-bottom"><span>{reduced ? cur : prev}</span></span>
      {!reduced && <>
        <span key={`t${flips}`} className="flap-half flap-top flap-leaf-top"><span>{prev}</span></span>
        <span key={`b${flips}`} className="flap-half flap-bottom flap-leaf-bottom"><span>{cur}</span></span>
      </>}
    </span>
  )
}

/** A row of flaps for a short string. `label` is what screen readers hear instead. */
export function SplitFlap({ text, label, size = 'row', stagger = 0 }: { text: string; label: string; size?: 'row' | 'hero' | 'clock' | 'pass'; stagger?: number }) {
  return (
    <span className={`split-flap flap-${size}`} role="img" aria-label={label}>
      {[...text].map((char, index) => char === ' '
        ? <span key={index} className="flap-gap" aria-hidden="true" />
        : char === ':' ? <span key={index} className="flap-colon" aria-hidden="true">:</span>
        : <Flap key={index} char={char} delay={stagger + index * 28} />)}
    </span>
  )
}

/** Live countdown to a deadline as split flaps with static unit labels. */
export function FlapCountdown({ deadline, rolling, size = 'row', stagger = 0 }: { deadline: string | null; rolling: boolean; size?: 'row' | 'hero' | 'pass'; stagger?: number }) {
  const now = useMinute()
  if (rolling) return <span className="countdown-word">Rolling</span>
  const end = deadlineMs(deadline)
  if (end === null) return <span className="countdown-word">TBA</span>
  if (end <= now) return <span className="countdown-word is-closed">Closed</span>
  const left = remaining(end, now)
  return (
    <span className={`flap-countdown flap-countdown-${size}`} role="img" aria-label={left.spoken} title={left.spoken}>
      <span aria-hidden="true" className="flap-unit-group"><SplitFlap text={left.days} label="" size={size} stagger={stagger} /><i>d</i></span>
      <span aria-hidden="true" className="flap-unit-group"><SplitFlap text={left.hours} label="" size={size} stagger={stagger + 60} /><i>h</i></span>
      <span aria-hidden="true" className="flap-unit-group"><SplitFlap text={left.minutes} label="" size={size} stagger={stagger + 120} /><i>m</i></span>
    </span>
  )
}

/** Deadline in UTC and IST, as two short lines. */
export function DeadlineClock({ deadline, rolling, compact = false }: { deadline: string | null; rolling: boolean; compact?: boolean }) {
  if (rolling) return <span className="deadline-clock is-muted"><span className="dc-line"><b>Rolling</b></span></span>
  const end = deadlineMs(deadline)
  if (end === null) return <span className="deadline-clock is-muted"><span className="dc-line"><b>TBA</b></span></span>
  const utc = zoneClock(end, 'UTC')
  const ist = zoneClock(end, 'IST')
  return (
    <span className={`deadline-clock ${compact ? 'is-compact' : ''}`}>
      <span className="dc-line"><b>{utc.time}</b><em>UTC</em><span>{utc.date}</span></span>
      <span className="dc-line dc-ist"><b>{ist.time}</b><em>IST</em><span>{ist.date}</span></span>
    </span>
  )
}
