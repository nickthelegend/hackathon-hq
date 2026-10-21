import { statusLabel, statusRule, type FlightStatus } from './flights'

export function StatusTag({ status, small = false }: { status: FlightStatus; small?: boolean }) {
  return <span className={`status-tag st-${status} ${small ? 'is-small' : ''}`} title={statusRule[status]}><span className="st-lamp" aria-hidden="true" />{statusLabel[status]}</span>
}

/** Barcode stripes drawn from a commit hash (decoration that still encodes the real head). */
export function Barcode({ seed }: { seed: string }) {
  const chars = [...seed.toLowerCase()]
  const digits = [...chars, ...[...chars].reverse(), ...chars].map((char) => parseInt(char, 36) || 0)
  let x = 0
  const bars = digits.flatMap((digit, index) => {
    const width = 1 + (digit % 3)
    const gap = 1 + ((digit >> 2) % 2) + (index % 2)
    const bar = { x, width }
    x += width + gap
    return [bar]
  })
  return (
    <svg className="barcode" viewBox={`0 0 ${Math.max(x, 1)} 24`} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((bar, index) => <rect key={index} x={bar.x} y="0" width={bar.width} height="24" />)}
    </svg>
  )
}
