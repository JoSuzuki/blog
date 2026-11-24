// Little synthesized sounds for the game (no audio files): a tick for the last
// seconds, a chime for a guessed card, a buzzer for "Tabu!", a swish for a
// skip and a horn when time is up. Muted by the reader's choice, remembered
// in localStorage. Browsers only allow audio after a click, which is always
// how a game starts here.

type SoundName = 'tick' | 'correct' | 'taboo' | 'skip' | 'end' | 'start'

const MUTE_KEY = 'taboo:muted'

let context: AudioContext | null = null

const audio = () => {
  if (typeof window === 'undefined') return null
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

export const isMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export const setMuted = (muted: boolean) => {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // Not remembered, that is all.
  }
}

const tone = (
  ctx: AudioContext,
  {
    type = 'sine',
    from,
    to = from,
    start = 0,
    duration,
    volume = 0.2,
  }: {
    type?: OscillatorType
    from: number
    to?: number
    start?: number
    duration: number
    volume?: number
  },
) => {
  const t0 = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, t0)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

export const play = (name: SoundName) => {
  if (isMuted()) return
  const ctx = audio()
  if (!ctx) return
  switch (name) {
    case 'tick':
      tone(ctx, { type: 'square', from: 1400, duration: 0.04, volume: 0.05 })
      break
    case 'correct':
      tone(ctx, { from: 880, duration: 0.14, volume: 0.18 })
      tone(ctx, { from: 1320, start: 0.08, duration: 0.22, volume: 0.16 })
      break
    case 'taboo':
      tone(ctx, {
        type: 'sawtooth',
        from: 160,
        to: 110,
        duration: 0.45,
        volume: 0.22,
      })
      tone(ctx, {
        type: 'square',
        from: 120,
        to: 90,
        duration: 0.45,
        volume: 0.12,
      })
      break
    case 'skip':
      tone(ctx, {
        type: 'triangle',
        from: 600,
        to: 200,
        duration: 0.18,
        volume: 0.12,
      })
      break
    case 'start':
      tone(ctx, { type: 'triangle', from: 520, duration: 0.1, volume: 0.15 })
      tone(ctx, {
        type: 'triangle',
        from: 780,
        start: 0.1,
        duration: 0.18,
        volume: 0.15,
      })
      break
    case 'end':
      tone(ctx, {
        type: 'sawtooth',
        from: 330,
        to: 320,
        duration: 0.7,
        volume: 0.12,
      })
      tone(ctx, {
        type: 'sawtooth',
        from: 415,
        to: 405,
        duration: 0.7,
        volume: 0.1,
      })
      break
  }
}
