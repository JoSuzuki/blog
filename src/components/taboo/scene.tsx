import {
  Environment,
  Lightformer,
  Shadow,
  Sparkles,
  Stars,
} from '@react-three/drei'
import {
  EffectComposer,
  Noise,
  Scanline,
  Vignette,
} from '@react-three/postprocessing'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
} from 'three'
import type { Group, Mesh, Texture, WebGLRenderer } from 'three'
import type { CardOutcome, Team } from '~/lib/taboo/game'
import type { CardFace } from '~/lib/taboo/room'
import { readPalette, useSiteTheme } from './theme'
import type { Palette, SiteTheme } from './theme'
import { PAPER, drawCardBack, drawCardFront, loadCardFonts } from './card-art'

// The table: the card in play floats over it, the deck and the two teams'
// piles lie on it, and cards fly between them as they are played. It only
// draws what it is given; every decision is made on the server.
//
// This module pulls in three.js, so it is loaded lazily and only in the
// browser (see TabooGame and TabooLobby).

export type SceneMode = 'lobby' | 'ready' | 'playing' | 'over'

export interface SceneCard {
  /** `turn:index`, unique for every card that goes on the table. */
  key: string
  /** The face, if this viewer may see it; otherwise the back shows. */
  card: CardFace | null
}

export interface SceneOutcome {
  key: string
  card: CardFace
  outcome: CardOutcome
}

export interface TabooSceneProps {
  mode: SceneMode
  /** The card on the table now, while playing. */
  tableCard: SceneCard | null
  /** What happened to the cards that already left the table, by key. */
  outcomes: SceneOutcome[]
  speakingTeam: Team
  scores: [number, number]
  /** Turn clock: fraction of the time left (1 → 0), null when not running. */
  timeLeft: number | null
  winner: Team | 'tie' | null
}

// ---------------------------------------------------------------------------
// Shared geometry and textures
// ---------------------------------------------------------------------------

const CARD_W = 2.5
const CARD_H = 3.5
const CARD_R = 0.17
const CARD_D = 0.024
const FACE_GAP = 0.0012
const TABLE_Y = -2.15

const SHADOW: Record<SiteTheme, string> = {
  light: '#1a0f33',
  dark: '#000000',
  secret: '#000000',
}

/** Each theme lights the table its own way. */
const Lights = ({ theme, palette }: { theme: SiteTheme; palette: Palette }) => {
  const warm = theme === 'secret' ? palette.accent : '#ffd9c2'
  const cool = theme === 'secret' ? palette.accent : '#c9d4ff'
  return (
    <>
      <ambientLight intensity={theme === 'light' ? 0.9 : 0.75} />
      <directionalLight position={[3, 6, 6]} intensity={0.9} />
      <directionalLight
        position={[-5, 2, 3]}
        intensity={theme === 'light' ? 0.35 : 0.6}
        color={theme === 'light' ? cool : palette.accent}
      />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={2}
          position={[0, 4, 4]}
          scale={[10, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1}
          color={warm}
          position={[-6, 1, 2]}
          scale={[3, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1}
          color={cool}
          position={[6, 1, 2]}
          scale={[3, 6, 1]}
        />
      </Environment>
    </>
  )
}

/** A square grid on the table, in the theme's accent: graph paper, or a radar. */
const TableGrid = ({ color, opacity }: { color: string; opacity: number }) => {
  const geometry = useMemo(() => {
    const points: number[] = []
    // From far behind the cards to just short of the camera.
    const [left, right, back, front] = [-16, 16, -18, 7]
    const step = 0.8
    for (let i = 0; left + i * step <= right; i++) {
      const x = left + i * step
      points.push(x, 0, back, x, 0, front)
    }
    for (let i = 0; back + i * step <= front; i++) {
      const z = back + i * step
      points.push(left, 0, z, right, 0, z)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(points, 3))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <lineSegments geometry={geometry} position={[0, TABLE_Y + 0.002, 0]}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  )
}

/** A sweeping red line, like a scanner passing over the table. */
const Sweep = ({ color }: { color: string }) => {
  const ref = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.z = -10 + ((clock.elapsedTime * 3) % 16)
  })
  return (
    <mesh
      ref={ref}
      position={[0, TABLE_Y + 0.003, 0]}
      rotation-x={-Math.PI / 2}
    >
      <planeGeometry args={[40, 0.06]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} />
    </mesh>
  )
}

/** The details each theme adds around the cards. */
const ThemeDetails = ({
  theme,
  palette,
}: {
  theme: SiteTheme
  palette: Palette
}) => {
  if (theme === 'light') {
    return <TableGrid color={palette.accent} opacity={0.14} />
  }
  if (theme === 'dark') {
    return (
      <>
        <Stars
          radius={30}
          depth={20}
          count={900}
          factor={2.2}
          fade
          speed={0.6}
        />
        <Sparkles
          count={40}
          scale={[12, 5, 4]}
          position={[0, 0.5, -2]}
          size={2.5}
          speed={0.3}
          color={palette.accent}
        />
      </>
    )
  }
  return (
    <>
      <TableGrid color={palette.accent} opacity={0.35} />
      <Sweep color={palette.accent} />
    </>
  )
}

const roundedCardShape = () => {
  const x = -CARD_W / 2
  const y = -CARD_H / 2
  const r = CARD_R
  const shape = new Shape()
  shape.moveTo(x + r, y)
  shape.lineTo(x + CARD_W - r, y)
  shape.absarc(x + CARD_W - r, y + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(x + CARD_W, y + CARD_H - r)
  shape.absarc(x + CARD_W - r, y + CARD_H - r, r, 0, Math.PI / 2, false)
  shape.lineTo(x + r, y + CARD_H)
  shape.absarc(x + r, y + CARD_H - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(x, y + r)
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return shape
}

const createGeometries = () => {
  const shape = roundedCardShape()
  const face = new ShapeGeometry(shape, 16)
  // ShapeGeometry's UVs are the vertex coordinates: map them to 0..1.
  const position = face.attributes.position
  const uv = face.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(
      i,
      (position.getX(i) + CARD_W / 2) / CARD_W,
      (position.getY(i) + CARD_H / 2) / CARD_H,
    )
  }
  uv.needsUpdate = true
  const body = new ExtrudeGeometry(shape, {
    depth: CARD_D,
    bevelEnabled: false,
    curveSegments: 16,
  })
  body.translate(0, 0, -CARD_D / 2)
  return { face, body }
}

type Geometries = ReturnType<typeof createGeometries>

const toTexture = (canvas: HTMLCanvasElement, gl: WebGLRenderer) => {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = gl.capabilities.getMaxAnisotropy()
  texture.needsUpdate = true
  return texture
}

/** Card textures, drawn once each and kept until the scene goes away. */
const useTextures = (
  fontsReady: boolean,
  theme: SiteTheme,
  palette: Palette,
) => {
  const gl = useThree((state) => state.gl)
  const cache = useRef(new Map<string, Texture>())
  useEffect(() => {
    const textures = cache.current
    return () => {
      for (const texture of textures.values()) texture.dispose()
      textures.clear()
    }
  }, [])
  return useMemo(() => {
    // Fonts arriving redraws everything that was drawn before them.
    if (fontsReady) {
      for (const texture of cache.current.values()) texture.dispose()
      cache.current.clear()
    }
    const get = (key: string, draw: () => HTMLCanvasElement) => {
      let texture = cache.current.get(key)
      if (!texture) {
        texture = toTexture(draw(), gl)
        cache.current.set(key, texture)
      }
      return texture
    }
    return {
      front: (card: CardFace, team: Team) =>
        get(`front:${theme}:${card.id}:${team}`, () =>
          drawCardFront(card, team, palette),
        ),
      back: (team?: Team) =>
        get(`back:${theme}:${team ?? 'x'}`, () =>
          drawCardBack({ theme, palette, team }),
        ),
    }
  }, [gl, fontsReady, theme, palette])
}

type Textures = ReturnType<typeof useTextures>

const DEMO_CARD: CardFace = {
  id: 0,
  word: 'Tabu',
  taboo: ['proibido', 'palavra', 'falar', 'carta', 'time'],
}

const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inCubic: (t: number) => t * t * t,
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface Layout {
  cardScale: number
  pileScale: number
  hover: [number, number, number]
  deck: [number, number, number]
  piles: Record<Team, [number, number, number]>
  fuseWidth: number
}

const useLayout = (): Layout => {
  const viewport = useThree((state) => state.viewport)
  return useMemo(() => {
    const narrow = viewport.aspect < 1
    const cardScale = MathUtils.clamp(
      Math.min(viewport.height / 5.4, viewport.width / (narrow ? 3.1 : 3.6)),
      0.55,
      1.12,
    )
    const pileScale = narrow ? 0.5 : 0.62
    const pileX = narrow
      ? viewport.width / 2 - 0.75 * pileScale - 0.15
      : Math.min(3.7, viewport.width / 2 - 1.2)
    return {
      cardScale,
      pileScale,
      hover: [0, 0.25, 0.7],
      deck: [0, TABLE_Y, -1.4],
      piles: {
        0: [-pileX, TABLE_Y, 0.2],
        1: [pileX, TABLE_Y, 0.2],
      },
      fuseWidth: Math.min(viewport.width * 0.8, 6.5),
    }
  }, [viewport.width, viewport.height, viewport.aspect])
}

// ---------------------------------------------------------------------------
// A card
// ---------------------------------------------------------------------------

const paperEdge = new MeshStandardMaterial({ color: '#efe6d4', roughness: 0.8 })

interface CardMeshProps {
  geometries: Geometries
  front: Texture
  back: Texture
  frontMaterial?: MeshStandardMaterial
  backMaterial?: MeshStandardMaterial
  shadows?: boolean
}

/** A card standing upright, front towards +z. */
const CardMesh = ({
  geometries,
  front,
  back,
  frontMaterial,
  backMaterial,
  shadows = true,
}: CardMeshProps) => (
  <>
    <mesh
      geometry={geometries.body}
      material={paperEdge}
      castShadow={shadows}
    />
    <mesh geometry={geometries.face} position-z={CARD_D / 2 + FACE_GAP}>
      {frontMaterial ? (
        <primitive object={frontMaterial} attach="material" />
      ) : (
        <meshStandardMaterial map={front} roughness={0.5} />
      )}
    </mesh>
    <mesh
      geometry={geometries.face}
      position-z={-(CARD_D / 2 + FACE_GAP)}
      rotation-y={Math.PI}
    >
      {backMaterial ? (
        <primitive object={backMaterial} attach="material" />
      ) : (
        <meshStandardMaterial map={back} roughness={0.5} />
      )}
    </mesh>
  </>
)

interface FlyingCardProps {
  geometries: Geometries
  textures: Textures
  layout: Layout
  team: Team
  /** The face once known (the viewer saw it, or it was played). */
  face: CardFace | null
  /** Set when the card leaves the table. */
  exit: CardOutcome | null
  /** The team whose pile gets a guessed card. */
  pileTeam: Team
  urgent: boolean
  /** Seconds to wait on the deck before being dealt (the last card leaves first). */
  delay: number
  /** Where a guessed card comes to rest on its pile. */
  landing: { pos: [number, number, number]; rz: number } | null
  onExited: () => void
}

const ENTER_S = 0.6
const EXIT_S: Record<CardOutcome, number> = {
  correct: 0.85,
  skipped: 0.55,
  taboo: 0.95,
  timeout: 0.6,
}
const FLAT_DOWN = Math.PI / 2
const TURN = Math.PI * 2

/**
 * How long the next card waits on the deck after the last one is played, so
 * it rises once the old card is out of its way.
 */
const DEAL_AFTER: Record<CardOutcome, number> = {
  correct: 0.4,
  skipped: 0.3,
  taboo: 0.65,
  timeout: 0.35,
}

/** The card in play: dealt from the deck, floating, then sent off. */
const TableCard = ({
  geometries,
  textures,
  layout,
  team,
  face,
  exit,
  pileTeam,
  urgent,
  delay,
  landing,
  onExited,
}: FlyingCardProps) => {
  const group = useRef<Group>(null)
  const born = useRef<number | null>(null)
  const exitStart = useRef<number | null>(null)
  const exitFrom = useRef<{ pos: number[]; rot: number[] } | null>(null)
  const done = useRef(false)

  const front = face ? textures.front(face, team) : textures.back()
  const back = textures.back()
  const [frontMaterial, backMaterial] = useMemo(
    () => [
      new MeshStandardMaterial({ map: front, roughness: 0.5 }),
      new MeshStandardMaterial({ map: back, roughness: 0.5 }),
    ],
    [front, back],
  )
  useEffect(
    () => () => {
      frontMaterial.dispose()
      backMaterial.dispose()
    },
    [frontMaterial, backMaterial],
  )
  // Hidden from this viewer: the back faces the camera.
  const showsBack = !face

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const now = state.clock.elapsedTime
    born.current ??= now + delay
    const s = layout.cardScale
    const [hx, hy, hz] = layout.hover
    const [dx, dy, dz] = layout.deck

    if (exit && exitStart.current === null) {
      exitStart.current = now
      exitFrom.current = {
        pos: [g.position.x, g.position.y, g.position.z],
        rot: [g.rotation.x, g.rotation.y, g.rotation.z],
      }
    }

    if (exitStart.current !== null && exit && exitFrom.current) {
      const t = Math.min(1, (now - exitStart.current) / EXIT_S[exit])
      const [px, py, pz] = exitFrom.current.pos
      const [rx, ry, rz] = exitFrom.current.rot
      const red = frontMaterial.emissive
      if (exit === 'correct') {
        // An arc to the team's pile, spinning on the way and slowing down to
        // rest face up exactly where it will lie on the pile.
        const e = ease.inOutCubic(t)
        const [tx, ty, tz] = landing?.pos ?? layout.piles[pileTeam]
        g.position.set(
          MathUtils.lerp(px, tx, e),
          MathUtils.lerp(py, ty, e) + Math.sin(e * Math.PI) * 1.4,
          MathUtils.lerp(pz, tz, e),
        )
        g.rotation.set(
          MathUtils.lerp(rx, -FLAT_DOWN, e),
          MathUtils.lerp(ry, Math.round(ry / TURN) * TURN + TURN, e),
          MathUtils.lerp(rz, landing?.rz ?? 0, e),
        )
        g.scale.setScalar(MathUtils.lerp(s, layout.pileScale, e))
      } else if (exit === 'skipped') {
        // Tossed aside and down, off the table.
        const e = ease.inCubic(t)
        g.position.set(px + e * 1.2, py - e * 6, pz + e * 1.5)
        g.rotation.set(rx - e * 0.9, ry, rz - e * 0.6)
      } else if (exit === 'taboo') {
        // A red flash and a shake, then flung away.
        const shakeT = Math.min(1, t / 0.4)
        const flyT = Math.max(0, (t - 0.4) / 0.6)
        const flash = Math.sin(Math.min(1, t / 0.4) * Math.PI)
        red.setRGB(flash * 0.9, 0, flash * 0.08)
        backMaterial.emissive.setRGB(flash * 0.9, 0, flash * 0.08)
        const shake = Math.sin(shakeT * Math.PI * 9) * (1 - shakeT) * 0.22
        const e = ease.inCubic(flyT)
        g.position.set(px + shake - e * 1.5, py + e * 6.5, pz - e * 2)
        g.rotation.set(rx + e * 0.8, ry, rz + shake * 0.6 + e * 1.8)
      } else {
        // Time's up: back under the deck, face down.
        const e = ease.inOutCubic(t)
        g.position.set(
          MathUtils.lerp(px, dx, e),
          MathUtils.lerp(py, dy + 0.3, e) + Math.sin(e * Math.PI) * 0.6,
          MathUtils.lerp(pz, dz, e),
        )
        g.rotation.set(
          MathUtils.lerp(rx, FLAT_DOWN, e),
          MathUtils.lerp(ry, Math.round(ry / (Math.PI * 2)) * Math.PI * 2, e),
          MathUtils.lerp(rz, 0, e),
        )
        g.scale.setScalar(MathUtils.lerp(s, layout.pileScale, e))
      }
      if (t >= 1 && !done.current) {
        done.current = true
        onExited()
      }
      return
    }

    // Dealt: up from the deck, turning upright (hidden while it waits).
    g.visible = now >= born.current
    const t = MathUtils.clamp((now - born.current) / ENTER_S, 0, 1)
    const e = ease.outCubic(t)
    const pointer = state.pointer
    const bob = Math.sin(now * 1.6) * 0.05
    const tremble = urgent ? Math.sin(now * 38) * 0.012 : 0
    const targetRotX = -pointer.y * 0.12 + 0.04
    const targetRotY = (showsBack ? Math.PI : 0) + pointer.x * 0.18
    g.position.set(
      MathUtils.lerp(dx, hx, e) + tremble,
      MathUtils.lerp(dy + 0.2, hy + bob, e) + Math.sin(e * Math.PI) * 0.5,
      MathUtils.lerp(dz, hz, e),
    )
    g.rotation.set(
      MathUtils.lerp(FLAT_DOWN, targetRotX, e),
      MathUtils.lerp(showsBack ? Math.PI : 0, targetRotY, e),
      Math.sin(now * 0.9) * 0.015 + tremble * 2,
    )
    g.scale.setScalar(MathUtils.lerp(layout.pileScale, s, e))
  })

  return (
    <group ref={group} scale={layout.pileScale}>
      <CardMesh
        geometries={geometries}
        front={front}
        back={back}
        frontMaterial={frontMaterial}
        backMaterial={backMaterial}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Stacks on the table
// ---------------------------------------------------------------------------

/** Deterministic jitter, so a pile does not reshuffle on every render. */
const jitter = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x) - 0.5
}

const LAYER = CARD_D + 0.004
const PILE_MESSINESS = 0.3
const pileSalt = (team: Team) => team * 31 + 3

/** Where the i-th card from the bottom of a pile lies, in the pile's own space. */
const pileSlot = (i: number, salt: number, messiness: number) => ({
  pos: [
    jitter(i, salt) * 0.12,
    CARD_D / 2 + i * LAYER,
    jitter(i, salt + 1) * 0.12,
  ] as [number, number, number],
  rz: jitter(i, salt + 2) * messiness,
})

/** The same, on the table (a team's pile is scaled down and placed). */
const pileSlotOnTable = (layout: Layout, team: Team, i: number) => {
  const { pos, rz } = pileSlot(i, pileSalt(team), PILE_MESSINESS)
  const [ox, oy, oz] = layout.piles[team]
  const k = layout.pileScale
  return {
    pos: [ox + pos[0] * k, oy + pos[1] * k, oz + pos[2] * k] as [
      number,
      number,
      number,
    ],
    rz,
  }
}

/** A guessed card at rest on its team's pile, face up. */
const PileCard = ({
  geometries,
  front,
  back,
  layout,
  team,
  layer,
}: {
  geometries: Geometries
  front: Texture
  back: Texture
  layout: Layout
  team: Team
  layer: number
}) => {
  const { pos, rz } = pileSlotOnTable(layout, team, layer)
  return (
    <group
      position={pos}
      rotation={[-FLAT_DOWN, 0, rz]}
      scale={layout.pileScale}
    >
      <CardMesh geometries={geometries} front={front} back={back} />
    </group>
  )
}

interface StackProps {
  geometries: Geometries
  back: Texture
  count: number
  position: [number, number, number]
  scale: number
  salt: number
  /** Spread of the cards' rotation, in radians. */
  messiness: number
  /** Cast the pile's shadow even with no cards (real cards lie on top). */
  shadow?: boolean
}

const MAX_STACK = 40

/** A pile of cards lying face down. */
const Stack = ({
  geometries,
  back,
  count,
  position,
  scale,
  salt,
  messiness,
  shadow = false,
}: StackProps) => {
  const shown = Math.min(count, MAX_STACK)
  return (
    <group position={position} scale={scale}>
      <Shadow
        position-y={0.002}
        rotation-x={-Math.PI / 2}
        scale={[CARD_W * 1.5, CARD_H * 1.3, 1]}
        opacity={count > 0 || shadow ? 0.35 : 0}
        color={SHADOW.light}
      />
      {Array.from({ length: shown }, (_, i) => {
        const slot = pileSlot(i, salt, messiness)
        return (
          <group key={i} position={slot.pos} rotation={[FLAT_DOWN, 0, slot.rz]}>
            {i === shown - 1 ? (
              <CardMesh geometries={geometries} front={back} back={back} />
            ) : (
              // Only the top card's face can be seen.
              <mesh geometry={geometries.body} material={paperEdge} />
            )}
          </group>
        )
      })}
    </group>
  )
}

// ---------------------------------------------------------------------------
// The clock, a fuse along the front of the table
// ---------------------------------------------------------------------------

const FUSE_CALM = new Color('#F6EAD3')
const FUSE_HOT = new Color('#FF3B47')

const Fuse = ({ timeLeft, width }: { timeLeft: number; width: number }) => {
  const bar = useRef<Group>(null)
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#F6EAD3',
        emissive: '#F6EAD3',
        emissiveIntensity: 0.5,
        roughness: 0.4,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame((state) => {
    const left = MathUtils.clamp(timeLeft, 0, 1)
    if (bar.current) {
      bar.current.scale.x = MathUtils.lerp(
        bar.current.scale.x,
        Math.max(left, 0.001),
        0.2,
      )
    }
    const heat = MathUtils.smoothstep(1 - left, 0.65, 1)
    material.color.copy(FUSE_CALM).lerp(FUSE_HOT, heat)
    material.emissive.copy(material.color)
    const pulse =
      left < 0.2 ? (Math.sin(state.clock.elapsedTime * 12) + 1) / 2 : 0
    material.emissiveIntensity = 0.4 + heat * 0.6 + pulse * 0.8
  })
  return (
    <group position={[0, TABLE_Y + 0.03, 2.3]}>
      <mesh>
        <boxGeometry args={[width, 0.03, 0.09]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
      <group ref={bar}>
        <mesh material={material} position-y={0.012}>
          <boxGeometry args={[width, 0.05, 0.11]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Confetti of tiny cards for the winners
// ---------------------------------------------------------------------------

const CONFETTI = 180

const Confetti = ({ colors }: { colors: string[] }) => {
  const mesh = useRef<InstancedMesh>(null)
  const viewport = useThree((state) => state.viewport)
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => ({
        x: jitter(i, 1) * 1.1,
        y: 4 + Math.abs(jitter(i, 2)) * 8,
        z: jitter(i, 3) * 3,
        speed: 0.9 + Math.abs(jitter(i, 4)) * 1.4,
        spin: jitter(i, 5) * 8,
        sway: Math.abs(jitter(i, 6)) * 2 + 0.5,
      })),
    [],
  )
  const dummy = useMemo(() => new Object3D(), [])
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const color = new Color()
    for (let i = 0; i < CONFETTI; i++) {
      m.setColorAt(i, color.set(colors[i % colors.length]))
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [colors])
  useFrame((state, delta) => {
    const m = mesh.current
    if (!m) return
    const time = state.clock.elapsedTime
    for (let i = 0; i < CONFETTI; i++) {
      const p = pieces[i]
      p.y -= p.speed * delta
      if (p.y < TABLE_Y) p.y = 5 + Math.abs(jitter(i, time)) * 3
      dummy.position.set(
        p.x * viewport.width + Math.sin(time * p.sway + i) * 0.3,
        p.y,
        p.z,
      )
      dummy.rotation.set(time * p.spin, time * p.spin * 0.7, i)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CONFETTI]}>
      <planeGeometry args={[0.12, 0.17]} />
      <meshStandardMaterial side={2} roughness={0.6} />
    </instancedMesh>
  )
}

// ---------------------------------------------------------------------------
// The hero card of the lobby: the demo card turning slowly
// ---------------------------------------------------------------------------

const HeroCard = ({
  geometries,
  textures,
  layout,
}: {
  geometries: Geometries
  textures: Textures
  layout: Layout
}) => {
  const group = useRef<Group>(null)
  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    g.rotation.y = t * 0.45 + state.pointer.x * 0.3
    g.rotation.x = -state.pointer.y * 0.15 + Math.sin(t * 0.7) * 0.05
    g.position.y = 0.1 + Math.sin(t * 1.3) * 0.08
  })
  return (
    <group ref={group} scale={layout.cardScale * 1.05}>
      <CardMesh
        geometries={geometries}
        front={textures.front(DEMO_CARD, 0)}
        back={textures.back()}
      />
    </group>
  )
}

/** Between turns: the next card waiting, face down, over the deck. */
const WaitingCard = ({
  geometries,
  textures,
  layout,
}: {
  geometries: Geometries
  textures: Textures
  layout: Layout
}) => {
  const group = useRef<Group>(null)
  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    const [dx, dy, dz] = layout.deck
    g.position.set(dx, dy + 1.6 + Math.sin(t * 1.4) * 0.12, dz + 0.4)
    g.rotation.set(
      0.35 - state.pointer.y * 0.1,
      Math.PI + state.pointer.x * 0.2 + Math.sin(t * 0.6) * 0.12,
      0,
    )
  })
  return (
    <group ref={group} scale={layout.cardScale * 0.7}>
      <CardMesh
        geometries={geometries}
        front={textures.back()}
        back={textures.back()}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

interface LiveCard {
  key: string
  face: CardFace | null
  team: Team
  exit: CardOutcome | null
  delay: number
  /** A guessed card's place among its team's real cards (0 is the first). */
  slot: number | null
}

interface LandedCard {
  key: string
  face: CardFace | null
}

/** The guessed cards drawn as themselves on a pile; older ones join the plain stack. */
const MAX_REAL_PILE = 14

const Table = (
  props: TabooSceneProps & {
    fontsReady: boolean
    theme: SiteTheme
    palette: Palette
  },
) => {
  const { theme, palette } = props
  const { mode, tableCard, outcomes, speakingTeam, scores, timeLeft, winner } =
    props
  const geometries = useMemo(createGeometries, [])
  useEffect(
    () => () => {
      geometries.face.dispose()
      geometries.body.dispose()
    },
    [geometries],
  )
  const textures = useTextures(props.fontsReady, theme, palette)
  const layout = useLayout()

  // The cards on (and leaving) the table, and the guessed cards that came to
  // rest on a pile (this session's: a reload starts the piles as plain stacks).
  const [cards, setCards] = useState<LiveCard[]>([])
  const [landed, setLanded] = useState<Record<Team, LandedCard[]>>({
    0: [],
    1: [],
  })
  const landedRef = useRef(landed)
  landedRef.current = landed
  const outcomeByKey = useMemo(
    () => new Map(outcomes.map((o) => [o.key, o])),
    [outcomes],
  )
  useEffect(() => {
    setCards((current) => {
      let changed = false
      let delay = 0
      const next = current.map((card) => {
        if (card.exit || card.key === tableCard?.key) return card
        changed = true
        const played = outcomeByKey.get(card.key)
        const exit = played?.outcome ?? 'timeout'
        delay = Math.max(delay, DEAL_AFTER[exit])
        return { ...card, face: played?.card ?? card.face, exit, slot: null }
      })
      // Guessed cards take the next places on their pile, in order.
      for (const card of next) {
        if (card.exit !== 'correct' || card.slot !== null) continue
        const taken = next.filter(
          (c) =>
            c.team === card.team && c.slot !== null && c.exit === 'correct',
        ).length
        card.slot = landedRef.current[card.team].length + taken
      }
      if (tableCard && !current.some((c) => c.key === tableCard.key)) {
        changed = true
        next.push({
          key: tableCard.key,
          face: tableCard.card,
          team: speakingTeam,
          exit: null,
          delay,
          slot: null,
        })
      }
      return changed ? next : current
    })
  }, [tableCard, outcomeByKey, speakingTeam])

  // A face this viewer gets after the card was dealt (a reconnection).
  useEffect(() => {
    if (!tableCard?.card) return
    const { key, card } = tableCard
    setCards((current) =>
      current.some((c) => c.key === key && !c.face)
        ? current.map((c) => (c.key === key ? { ...c, face: card } : c))
        : current,
    )
  }, [tableCard])

  // A new game starts with empty piles.
  const fresh = scores[0] === 0 && scores[1] === 0
  useEffect(() => {
    if (fresh)
      setLanded((current) =>
        current[0].length || current[1].length ? { 0: [], 1: [] } : current,
      )
  }, [fresh])

  const handleExited = (card: LiveCard) => {
    setCards((current) => current.filter((c) => c.key !== card.key))
    if (card.exit === 'correct') {
      setLanded((current) => ({
        ...current,
        [card.team]: [
          ...current[card.team],
          { key: card.key, face: card.face },
        ],
      }))
    }
  }

  // Each pile: a plain stack for the points this browser did not see land,
  // then the real cards on top, then the places of the cards in flight.
  const piles = ([0, 1] as const).map((team) => {
    const real = landed[team].slice(-MAX_REAL_PILE)
    const flying = cards.filter((c) => c.team === team && c.exit === 'correct')
    const base = Math.max(0, scores[team] - real.length - flying.length)
    return { real, base, landedCount: landed[team].length }
  })
  const landingFor = (card: LiveCard) => {
    if (card.exit !== 'correct' || card.slot === null) return null
    const pile = piles[card.team]
    const layer = pile.base + pile.real.length + (card.slot - pile.landedCount)
    return pileSlotOnTable(layout, card.team, layer)
  }

  const urgent = timeLeft !== null && timeLeft < 0.12

  const winnerColors =
    winner === null
      ? []
      : winner === 'tie'
        ? [palette.team[0].light, palette.team[1].light, PAPER]
        : [palette.team[winner].light, palette.team[winner].dark, PAPER]

  return (
    <>
      <Lights theme={theme} palette={palette} />
      <ThemeDetails theme={theme} palette={palette} />

      {mode === 'lobby' ? (
        <HeroCard geometries={geometries} textures={textures} layout={layout} />
      ) : (
        <>
          <Stack
            geometries={geometries}
            back={textures.back()}
            count={14}
            position={layout.deck}
            scale={layout.pileScale}
            salt={7}
            messiness={0.04}
          />
          {([0, 1] as const).map((team) => (
            <group key={team}>
              <Stack
                geometries={geometries}
                back={textures.back(team)}
                count={piles[team].base}
                position={layout.piles[team]}
                scale={layout.pileScale}
                salt={pileSalt(team)}
                messiness={PILE_MESSINESS}
                shadow={piles[team].real.length > 0}
              />
              {piles[team].real.map((card, i) => (
                <PileCard
                  key={card.key}
                  geometries={geometries}
                  front={
                    card.face
                      ? textures.front(card.face, team)
                      : textures.back(team)
                  }
                  back={textures.back(team)}
                  layout={layout}
                  team={team}
                  layer={piles[team].base + i}
                />
              ))}
            </group>
          ))}
          {mode === 'ready' && (
            <WaitingCard
              geometries={geometries}
              textures={textures}
              layout={layout}
            />
          )}
          {cards.map((card) => (
            <TableCard
              key={card.key}
              geometries={geometries}
              textures={textures}
              layout={layout}
              team={card.team}
              face={card.face}
              exit={card.exit}
              pileTeam={card.team}
              urgent={urgent && !card.exit}
              delay={card.delay}
              landing={landingFor(card)}
              onExited={() => handleExited(card)}
            />
          ))}
          {mode === 'playing' && timeLeft !== null && (
            <Fuse timeLeft={timeLeft} width={layout.fuseWidth} />
          )}
          {mode === 'over' && winnerColors.length > 0 && (
            <Confetti colors={winnerColors} />
          )}
        </>
      )}

      {mode !== 'over' && (
        // The soft shadow of the card in the air.
        <Shadow
          position={[layout.hover[0], TABLE_Y + 0.001, layout.hover[2]]}
          rotation-x={-Math.PI / 2}
          scale={[CARD_W * layout.cardScale * 1.4, 1.6, 1]}
          opacity={0.3}
          color={SHADOW[theme]}
        />
      )}
    </>
  )
}

/** The table, in a transparent canvas over the page's own background. */
const TabooScene = (props: TabooSceneProps) => {
  const [fontsReady, setFontsReady] = useState(false)
  const theme = useSiteTheme()
  // The tokens change with the theme.
  const palette = useMemo(() => readPalette(), [theme])
  useEffect(() => {
    let alive = true
    void loadCardFonts().then(() => alive && setFontsReady(true))
    return () => {
      alive = false
    }
  }, [])
  return (
    <Canvas
      dpr={[1, 1.5]}
      flat
      camera={{ position: [0, 1.5, 9.5], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ camera }) => camera.lookAt(0, -0.35, 0)}
    >
      <Table
        {...props}
        fontsReady={fontsReady}
        theme={theme}
        palette={palette}
      />
      {theme === 'secret' && (
        // A surveillance monitor: scanlines, grain and dark corners.
        <EffectComposer multisampling={0}>
          <Scanline density={1.6} opacity={0.18} />
          <Noise opacity={0.08} />
          <Vignette offset={0.25} darkness={0.75} />
        </EffectComposer>
      )}
    </Canvas>
  )
}

export default TabooScene
