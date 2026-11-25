import type { Team } from '~/lib/taboo/game'
import type { CardFace } from '~/lib/taboo/room'
import type { Palette, SiteTheme } from './theme'

// The card faces, drawn on a canvas: the 3D scene uses them as textures, and
// they are big enough (1024 × 1434, the 5:7 of a playing card) to stay sharp
// when the card fills the screen. Plain 2D canvas, no three.js here.

export const CARD_PX = { width: 1024, height: 1434 } as const

/** The card's own paper and ink: the cards look the same in every theme. */
export const PAPER = '#FBF7EF'
export const INK = '#1C1A2B'
const RULE = '#E7DFCF'
const BACK = { light: '#5B3AA6', dark: '#2A1652', cream: '#F6EAD3' }

const SANS =
  "'Inter var', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

/** Waits for the site's font so the first textures are not drawn in a fallback. */
export const loadCardFonts = async () => {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`850 120px ${SANS}`, 'TABUÇÃ'),
        document.fonts.load(`600 72px ${SANS}`, 'tabuçã'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ])
  } catch {
    // Draw with whatever font there is.
  }
}

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const setSpacing = (ctx: CanvasRenderingContext2D, px: number) => {
  // Not in every browser yet; without it the text is just a bit tighter.
  ;(
    ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  ).letterSpacing = `${px}px`
}

/** Splits a word into at most two lines that fit, shrinking the font as needed. */
const fitWord = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
): { lines: string[]; size: number } => {
  const words = text.split(' ')
  for (let size = maxSize; size >= minSize; size -= 4) {
    ctx.font = `850 ${size}px ${SANS}`
    if (ctx.measureText(text).width <= maxWidth) return { lines: [text], size }
    if (words.length > 1 && size <= maxSize * 0.8) {
      // Best two-line split: the one with the narrower longest line.
      let best: string[] | null = null
      let bestWidth = Infinity
      for (let i = 1; i < words.length; i++) {
        const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')]
        const width = Math.max(...lines.map((l) => ctx.measureText(l).width))
        if (width < bestWidth) {
          best = lines
          bestWidth = width
        }
      }
      if (best && bestWidth <= maxWidth) return { lines: best, size }
    }
  }
  ctx.font = `850 ${minSize}px ${SANS}`
  return { lines: [text], size: minSize }
}

const fitText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  maxWidth: number,
  size: number,
) => {
  let s = size
  ctx.font = `${weight} ${s}px ${SANS}`
  while (s > 28 && ctx.measureText(text).width > maxWidth) {
    s -= 2
    ctx.font = `${weight} ${s}px ${SANS}`
  }
  return s
}

const newCanvas = () => {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_PX.width
  canvas.height = CARD_PX.height
  const ctx = canvas.getContext('2d')!
  return { canvas, ctx }
}

/** The front of a card: the word on the team's color, the five forbidden words below. */
export const drawCardFront = (
  card: CardFace,
  team: Team,
  palette: Palette,
): HTMLCanvasElement => {
  const { canvas, ctx } = newCanvas()
  const { width: W, height: H } = CARD_PX
  const color = palette.team[team]

  // Paper, with transparent rounded corners.
  roundedRect(ctx, 0, 0, W, H, 72)
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.save()
  ctx.clip()

  // Header block.
  const pad = 44
  const headerH = 540
  roundedRect(ctx, pad, pad, W - pad * 2, headerH, 44)
  const gradient = ctx.createLinearGradient(0, pad, 0, pad + headerH)
  gradient.addColorStop(0, color.light)
  gradient.addColorStop(1, color.dark)
  ctx.fillStyle = gradient
  ctx.fill()

  // A soft sheen across the header.
  ctx.save()
  roundedRect(ctx, pad, pad, W - pad * 2, headerH, 44)
  ctx.clip()
  const sheen = ctx.createLinearGradient(pad, pad, W - pad, pad + headerH)
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)')
  sheen.addColorStop(0.45, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(pad, pad, W - pad * 2, headerH)
  ctx.restore()

  // Header labels.
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 34px ${SANS}`
  setSpacing(ctx, 6)
  ctx.textAlign = 'left'
  ctx.fillText('TABU', pad + 44, pad + 76)
  ctx.textAlign = 'right'
  ctx.fillText(
    `Nº ${String(card.id + 1).padStart(3, '0')}`,
    W - pad - 44,
    pad + 76,
  )

  // The word.
  setSpacing(ctx, -3)
  const { lines, size } = fitWord(
    ctx,
    card.word.toUpperCase(),
    W - pad * 2 - 100,
    156,
    64,
  )
  ctx.font = `850 ${size}px ${SANS}`
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.18)'
  ctx.shadowOffsetY = 6
  ctx.shadowBlur = 12
  const lineH = size * 1.02
  const centerY = pad + headerH / 2 + 26
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, centerY + (i - (lines.length - 1) / 2) * lineH)
  })
  ctx.shadowColor = 'transparent'

  // "Não diga" label.
  const bodyTop = pad + headerH + 78
  ctx.font = `750 34px ${SANS}`
  setSpacing(ctx, 8)
  ctx.fillStyle = color.dark
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('NÃO DIGA', W / 2, bodyTop)

  // The forbidden words.
  setSpacing(ctx, -1)
  const rowTop = bodyTop + 36
  const rowH = (H - rowTop - 120) / 5
  card.taboo.slice(0, 5).forEach((word, i) => {
    const y = rowTop + rowH * i
    if (i > 0) {
      ctx.fillStyle = RULE
      ctx.fillRect(pad + 60, y, W - (pad + 60) * 2, 3)
    }
    const midY = y + rowH / 2
    // The "no" mark.
    const markX = pad + 92
    ctx.strokeStyle = color.light
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(markX, midY, 24, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(markX - 17, midY + 17)
    ctx.lineTo(markX + 17, midY - 17)
    ctx.stroke()

    const textSize = fitText(ctx, word.toUpperCase(), 640, W - markX - 150, 68)
    ctx.font = `640 ${textSize}px ${SANS}`
    ctx.fillStyle = INK
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(word.toUpperCase(), markX + 62, midY + 3)
  })

  // Footer.
  ctx.font = `600 28px ${SANS}`
  setSpacing(ctx, 4)
  ctx.fillStyle = 'rgba(28,26,43,0.38)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('JOSUZUKI.ME', W / 2, H - 58)

  ctx.restore()
  return canvas
}

/**
 * The back. Each theme has its own: the blog's purple by day, a starry night
 * in the dark theme, a classified file in the secret one. The teams' piles
 * use a back in the team's color.
 */
export const drawCardBack = ({
  theme,
  palette,
  team,
}: {
  theme: SiteTheme
  palette: Palette
  team?: Team
}): HTMLCanvasElement => {
  const { canvas, ctx } = newCanvas()
  const { width: W, height: H } = CARD_PX
  const secret = theme === 'secret' && team === undefined
  const base =
    team !== undefined
      ? palette.team[team]
      : theme === 'dark'
        ? { light: '#2B1470', dark: '#0B0326' }
        : secret
          ? { light: '#2A0008', dark: '#080001' }
          : BACK
  const cream = secret ? '#FF2A44' : BACK.cream

  roundedRect(ctx, 0, 0, W, H, 72)
  const gradient = ctx.createLinearGradient(0, 0, W, H)
  gradient.addColorStop(0, base.light)
  gradient.addColorStop(1, base.dark)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.save()
  ctx.clip()

  // A diagonal pattern of the word ("CONFIDENCIAL" on a secret card).
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-Math.PI / 6)
  ctx.font = `850 ${secret ? 44 : 64}px ${SANS}`
  setSpacing(ctx, 10)
  ctx.fillStyle = secret ? 'rgba(255,42,68,0.13)' : 'rgba(255,255,255,0.07)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const word = secret ? 'CONFIDENCIAL' : 'TABU'
  const step = secret ? 460 : 300
  for (let row = -14; row <= 14; row++) {
    const offset = (row % 2) * (step / 2)
    for (let col = -6; col <= 6; col++) {
      ctx.fillText(word, col * step + offset, row * 110)
    }
  }
  ctx.restore()

  // Stars and a moon, at night.
  if (theme === 'dark' && team === undefined) {
    for (let i = 0; i < 90; i++) {
      const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W
      const y = (Math.sin(i * 47.3 + 2) * 0.5 + 0.5) * H
      const r = 1.5 + (Math.sin(i * 13.1) * 0.5 + 0.5) * 3.5
      ctx.fillStyle = `rgba(246,234,211,${0.35 + (i % 5) * 0.12})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = BACK.cream
    ctx.beginPath()
    ctx.arc(W - 210, 230, 70, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = base.light
    ctx.beginPath()
    ctx.arc(W - 180, 205, 62, 0, Math.PI * 2)
    ctx.fill()
  }

  // Inner frame: square cut corners on a secret card, rounded otherwise.
  ctx.strokeStyle = secret ? 'rgba(255,42,68,0.7)' : 'rgba(246,234,211,0.55)'
  ctx.lineWidth = 6
  roundedRect(ctx, 56, 56, W - 112, H - 112, secret ? 4 : 44)
  ctx.stroke()

  // The logo.
  const logoW = 640
  const logoH = 300
  roundedRect(
    ctx,
    (W - logoW) / 2,
    (H - logoH) / 2,
    logoW,
    logoH,
    secret ? 6 : 150,
  )
  ctx.fillStyle = cream
  ctx.shadowColor = secret ? 'rgba(255,42,68,0.6)' : 'rgba(0,0,0,0.25)'
  ctx.shadowOffsetY = secret ? 0 : 10
  ctx.shadowBlur = secret ? 50 : 30
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.font = `850 176px ${SANS}`
  setSpacing(ctx, -4)
  ctx.fillStyle = secret ? '#080001' : base.dark
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('TABU', W / 2, H / 2 + 8)

  if (secret) {
    // A "SECRETO" stamp, and the site's name blacked out.
    ctx.save()
    ctx.translate(W / 2 + 150, H / 2 - 260)
    ctx.rotate(-0.22)
    ctx.strokeStyle = '#FF2A44'
    ctx.lineWidth = 8
    ctx.strokeRect(-190, -55, 380, 110)
    ctx.font = `850 72px ${SANS}`
    setSpacing(ctx, 8)
    ctx.fillStyle = '#FF2A44'
    ctx.fillText('SECRETO', 0, 4)
    ctx.restore()
    ctx.fillStyle = '#000000'
    ctx.fillRect(W / 2 - 200, H - 150, 260, 54)
    ctx.fillRect(W / 2 + 80, H - 150, 120, 54)
  } else {
    ctx.font = `700 30px ${SANS}`
    setSpacing(ctx, 6)
    ctx.fillStyle = 'rgba(246,234,211,0.75)'
    ctx.fillText('JOSUZUKI.ME', W / 2, H - 120)
  }

  ctx.restore()
  return canvas
}
