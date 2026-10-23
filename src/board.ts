// Shared non-component helpers: time, formatting, link safety and overlay focus. Kept out of the
// .tsx files so each of those exports only components (React fast refresh needs that).
import { useEffect, useSyncExternalStore, type RefObject } from 'react'

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

/** The value itself when it is an absolute https:// URL, else null. Every rendered href goes through this. */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' && url.hostname ? trimmed : null
  } catch {
    return null
  }
}

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Tab and Shift+Tab wrap inside the element while it is mounted (drawers and dialogs). */
export function useFocusTrap(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const root = ref.current
      if (event.key !== 'Tab' || !root) return
      const items = [...root.querySelectorAll<HTMLElement>(focusable)].filter((item) => item.getClientRects().length > 0)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const outside = !root.contains(active)
      if (event.shiftKey && (outside || active === first)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (outside || active === last)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ref])
}
