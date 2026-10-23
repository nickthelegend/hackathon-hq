import { useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { deadlineMs, remaining, useFocusTrap, useMinute, useReducedMotion, zoneClock } from './board'

/**
 * One split-flap character. When the character changes, the old top leaf falls away and the
 * new bottom leaf lands (the page's one animation). On mount it flips once through its own
 * character, staggered by `delay`, so the first frame (and a screenshot or a slow device) already
 * shows the real digits, never a blank tile. With reduced motion it renders the character statically.
 */
function Flap({ char, delay }: { char: string; delay: number }) {
  const reduced = useReducedMotion()
  const [state, setState] = useState({ cur: char, prev: char, flips: 1 })
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

/** Asks before Reset to seed and names exactly what would be lost. Cancel has focus, so Enter is safe. */
export function ConfirmReset({ board, losses, onCancel, onConfirm }: { board: string; losses: string[]; onCancel: () => void; onConfirm: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  useFocusTrap(panel)
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <div ref={panel} className="dialog is-confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
        <div className="dialog-head"><div><p className="eyebrow">Reset to seed</p><h2 id="confirm-title">Reset the {board}?</h2></div></div>
        <div id="confirm-body" className="confirm-body">
          {losses.length
            ? <><p>The board goes back to the seed. This can't be undone; you will lose what is saved in this browser:</p><ul className="loss-list">{losses.map((loss) => <li key={loss}>{loss}</li>)}</ul></>
            : <p>Nothing has been changed in this browser, so the board already matches the seed.</p>}
        </div>
        <div className="dialog-actions">
          <button type="button" className="button ghost" onClick={onCancel} autoFocus>Cancel</button>
          <button type="button" className="button danger" onClick={onConfirm}><RotateCcw size={15} aria-hidden="true" />Reset board</button>
        </div>
      </div>
    </div>
  )
}
