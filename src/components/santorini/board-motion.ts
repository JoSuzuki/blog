import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { LineBasicMaterial, Object3D } from 'three'

// The timing behind the board's animations: easing curves, the reader's
// reduced-motion setting, and a clock that starts when a piece appears.
// Every animation is driven from useFrame by writing to refs, never through
// React state, so nothing re-renders while a piece is moving.

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
export const easeOutCubic = (p: number) => 1 - (1 - p) ** 3
export const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2
export const easeOutBack = (p: number) => {
  const c1 = 1.70158
  return 1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2
}
/** A block landing: a fall, then two small bounces. */
export const easeOutBounce = (p: number) => {
  const n = 7.5625
  const d = 2.75
  if (p < 1 / d) return n * p * p
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375
  return n * (p -= 2.625 / d) * p + 0.984375
}
/** Where easeOutBounce first touches the ground. */
export const BOUNCE_IMPACT = 1 / 2.75

/** The reader's "reduce motion" setting, kept up to date. */
export const useReducedMotion = () => {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

export interface BoardMotion {
  /** No movement at all: every piece is drawn where it ends up. */
  reduced: boolean
  /**
   * True while the board draws for the first time. Pieces that appear then
   * are the opening position, so they come in one after the other.
   */
  intro: { current: boolean }
}

export const BoardMotionContext = createContext<BoardMotion>({
  reduced: false,
  intro: { current: false },
})

export const useBoardMotion = () => useContext(BoardMotionContext)

/**
 * Seconds since this piece appeared, less `delay`: negative while it waits,
 * Infinity when motion is reduced (so every animation reads as finished).
 * The clock starts on the first frame the piece is drawn.
 */
export const useSinceMount = (delay = 0) => {
  const { reduced } = useBoardMotion()
  const start = useRef<number | null>(null)
  return (time: number) => {
    if (reduced) return Infinity
    start.current ??= time + delay
    return time - start.current
  }
}

/**
 * One expanding, fading outline: a landing, a pick, a build. `since` is the
 * seconds since it started; it is hidden before and after.
 */
export const animateRipple = (
  line: Object3D | null,
  since: number,
  duration = 0.55,
  grow = 0.8,
  strength = 1,
) => {
  if (!line) return
  const p = since / duration
  line.visible = p >= 0 && p < 1
  if (!line.visible) return
  line.scale.setScalar(1 + grow * easeOutCubic(p))
  ;(line as Object3D & { material: LineBasicMaterial }).material.opacity =
    strength * (1 - p) ** 1.5
}
