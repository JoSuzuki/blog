import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  DataTexture,
  EdgesGeometry,
  Float32BufferAttribute,
  NearestFilter,
  NormalBlending,
  PlaneGeometry,
  OctahedronGeometry,
  SRGBColorSpace,
  SphereGeometry,
  Vector3,
  WireframeGeometry,
} from 'three'
import type {
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import { useSiteTheme } from '~/lib/site-theme'
import type { SiteTheme } from '~/components/taboo/theme'
import {
  BOARD_SIZE,
  DOME_HEIGHT,
  WINNING_HEIGHT,
  canExecuteAction,
} from '~/lib/santorini/game'
import type {
  ActionType,
  GameState,
  Position,
  Worker as WorkerPiece,
} from '~/lib/santorini/game'
import {
  BOUNCE_IMPACT,
  BoardMotionContext,
  animateRipple,
  clamp01,
  easeInOutCubic,
  easeOutBack,
  easeOutBounce,
  easeOutCubic,
  useBoardMotion,
  useReducedMotion,
  useSinceMount,
} from './board-motion'

// The 3D board, drawn like an old vector display: a glowing grid, light
// solid towers with an ink outline, wire domes and wire-gem workers. It only
// draws the state it is given and reports clicks; the rules live in
// ~/lib/santorini/game and every move is decided on the server.
//
// It animates the difference between one state and the next, so the same
// motion plays for the player, for whoever watches live, and in the replay:
// workers hop from square to square, floors and domes fall into place, the
// opening position stacks up tile by tile, and a win lights a beam with
// sparks. With reduced motion every piece is simply drawn where it ends up.
//
// This module pulls in three.js, so it is loaded lazily and only in the
// browser (see SantoriniGame).

export interface BoardProps {
  /** The game with the current turn's pending steps already applied. */
  gameState: GameState
  nextActionType: ActionType | null
  /** The viewer's seat: their workers are red, the opponent's blue. */
  playerId: number
  canPerformActions: boolean
  onTileClick: (tile: Position) => void
  onWorkerClick: (worker: WorkerPiece) => void
}

interface Palette {
  background: string
  /** The board grid, the coordinates and the floor. */
  grid: string
  floor: string
  /** Towers: a light fill with a dark outline, in every theme. */
  towerFill: string
  towerInk: string
  dome: string
  /** The viewer's workers and the squares they can play on. */
  mine: string
  theirs: string
  /** Additive glow on the grid (dark themes only). */
  glow: boolean
  scanlines: number
}

// Team colors are the --colors-team-* tokens; the rest are the theme tokens
// pushed brighter or darker for a screen.
const PALETTES: Record<SiteTheme, Palette> = {
  light: {
    background: '#c8d4b8',
    grid: '#1d2a14',
    floor: '#5c6e4c',
    towerFill: '#eef3e4',
    towerInk: '#1d2a14',
    dome: '#1d2a14',
    mine: '#d3263a',
    theirs: '#1f3fd1',
    glow: false,
    scanlines: 0.1,
  },
  dark: {
    background: '#08021c',
    grid: '#9a94ff',
    floor: '#3a2f8a',
    towerFill: '#eeebff',
    towerInk: '#3a2f8a',
    dome: '#5a4fd0',
    mine: '#ff5257',
    theirs: '#5d86ff',
    glow: true,
    scanlines: 0.28,
  },
  secret: {
    background: '#080002',
    grid: '#ff2a40',
    floor: '#5a0812',
    towerFill: '#fff4ec',
    towerInk: '#8a0010',
    dome: '#d0102a',
    mine: '#ff5257',
    theirs: '#7aa0ff',
    glow: true,
    scanlines: 0.28,
  },
}

/** Levels 1 to 3 get narrower as they go up, like the real pieces. */
const LEVELS = [
  { size: 0.9, height: 0.42 },
  { size: 0.76, height: 0.36 },
  { size: 0.62, height: 0.32 },
]
const DOME_RADIUS = 0.28
const HALF = BOARD_SIZE / 2

const levelBase = (level: number) =>
  LEVELS.slice(0, level).reduce((sum, { height }) => sum + height, 0)
/** Where a worker stands, or a marker lies, on a tile of this height. */
const topOf = (height: number) => levelBase(Math.min(height, DOME_HEIGHT - 1))
const worldX = (x: number) => x - (BOARD_SIZE - 1) / 2
const worldZ = (y: number) => y - (BOARD_SIZE - 1) / 2

// Shared geometry: built once, used by every tile.
const levelGeometry = LEVELS.map(
  ({ size, height }) => new BoxGeometry(size, height, size),
)
const levelEdges = levelGeometry.map((geometry) => new EdgesGeometry(geometry))
const domeGeometry = new SphereGeometry(
  DOME_RADIUS,
  10,
  4,
  0,
  Math.PI * 2,
  0,
  Math.PI / 2,
)
const domeWire = new WireframeGeometry(domeGeometry)
const gemGeometry = new OctahedronGeometry(0.2, 0)
const gemWire = new WireframeGeometry(gemGeometry)
const gemFill = new OctahedronGeometry(0.19, 0)
const discGeometry = new CircleGeometry(DOME_RADIUS, 48)

const ringGeometry = (radius: number) =>
  new BufferGeometry().setFromPoints(
    Array.from({ length: 64 }, (_, i) => {
      const angle = (i / 64) * Math.PI * 2
      return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    }),
  )
const innerRing = ringGeometry(DOME_RADIUS)
// The footprint of the floor a build would add on a tile of each height.
const squareOutlines = LEVELS.map(({ size }) => {
  const h = size / 2
  return new BufferGeometry().setFromPoints(
    [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ].map(([x, z]) => new Vector3(x, 0, z)),
  )
})
const squareFills = LEVELS.map(({ size }) => new PlaneGeometry(size, size))
const outerRing = ringGeometry(DOME_RADIUS + 0.08)

const lineGrid = (from: number, to: number, y: number) => {
  const points: number[] = []
  for (let i = from; i <= to; i++) {
    points.push(from, y, i, to, y, i, i, y, from, i, y, to)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
  return geometry
}
const boardGrid = (() => {
  const points: number[] = []
  for (let i = 0; i <= BOARD_SIZE; i++) {
    const k = i - HALF
    points.push(-HALF, 0, k, HALF, 0, k, k, 0, -HALF, k, 0, HALF)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
  return geometry
})()
const floorGrid = lineGrid(-12, 12, -0.01)

/** Three hard bands of light: the towers read as solid blocks, not shaded. */
const toonRamp = (() => {
  const ramp = new DataTexture(
    new Uint8Array([
      110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255,
    ]),
    3,
    1,
  )
  ramp.minFilter = ramp.magFilter = NearestFilter
  ramp.needsUpdate = true
  return ramp
})()

const labelTexture = (text: string, color: string) => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = color
    context.font = '700 96px ui-monospace, Menlo, Consolas, monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, 64, 68)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** The board grid, with extra faint copies for a phosphor glow. */
const Grid = ({ palette }: { palette: Palette }) => {
  const passes = palette.glow
    ? [
        [1, 0.85],
        [1.004, 0.3],
        [1.008, 0.15],
      ]
    : [[1, 0.9]]
  const blending = palette.glow ? AdditiveBlending : NormalBlending
  return (
    <>
      {passes.map(([scale, opacity]) => (
        <lineSegments key={scale} geometry={boardGrid} scale={scale}>
          <lineBasicMaterial
            color={palette.grid}
            transparent
            opacity={opacity}
            blending={blending}
          />
        </lineSegments>
      ))}
      <lineSegments geometry={floorGrid}>
        <lineBasicMaterial
          color={palette.floor}
          transparent
          opacity={palette.glow ? 0.5 : 0.25}
          blending={blending}
          depthWrite={false}
        />
      </lineSegments>
    </>
  )
}

/**
 * A–E along the front edge and 1–5 down the right one, each centred on its
 * column or row: the two edges no tower covers from the starting view.
 */
const Coordinates = ({ palette }: { palette: Palette }) => {
  const labels = useMemo(() => {
    const columns = 'ABCDE'.slice(0, BOARD_SIZE).split('')
    return [
      ...columns.map((text, x) => ({
        text,
        position: [worldX(x), 0.002, HALF + 0.3] as const,
      })),
      ...columns.map((_, y) => ({
        text: String(y + 1),
        position: [HALF + 0.3, 0.002, worldZ(y)] as const,
      })),
    ].map((label) => ({
      ...label,
      texture: labelTexture(label.text, palette.grid),
    }))
  }, [palette.grid])
  useEffect(
    () => () => labels.forEach(({ texture }) => texture.dispose()),
    [labels],
  )
  return (
    <>
      {labels.map(({ text, position, texture }) => (
        <mesh
          key={text}
          position={position}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={3}
        >
          <planeGeometry args={[0.4, 0.4]} />
          <meshBasicMaterial
            map={texture}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  )
}

/** Seconds a floor or a dome takes to fall into place. */
const DROP_SECONDS = 0.6
const DROP_FROM = 1.6

/**
 * A floor or a dome that falls onto its tower when it is built, bounces and
 * puffs an outline of its footprint. `delay` holds it back (in seconds):
 * the opening position stacks up tile by tile.
 */
const Drop = ({
  y,
  delay,
  outline,
  palette,
  children,
}: {
  /** Where its centre ends up, above the tile. */
  y: number
  delay: number
  /** The footprint to puff when it lands, at the bottom of the piece. */
  outline: { geometry: BufferGeometry; at: number }
  palette: Palette
  children: ReactNode
}) => {
  const piece = useRef<Group>(null)
  const puff = useRef<LineLoop>(null)
  const { reduced } = useBoardMotion()
  const since = useSinceMount(delay)
  useFrame(({ clock }) => {
    const s = since(clock.elapsedTime)
    if (piece.current) {
      const p = clamp01(s / DROP_SECONDS)
      piece.current.visible = s >= 0
      piece.current.position.y = y + DROP_FROM * (1 - easeOutBounce(p))
    }
    animateRipple(puff.current, s - DROP_SECONDS * BOUNCE_IMPACT, 0.5, 0.45)
  })
  return (
    <>
      <group ref={piece} position={[0, y, 0]} visible={reduced}>
        {children}
      </group>
      <lineLoop
        ref={puff}
        geometry={outline.geometry}
        position={[0, outline.at + 0.005, 0]}
        visible={false}
      >
        <lineBasicMaterial
          color={palette.grid}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineLoop>
    </>
  )
}

/**
 * Up to three solid floors and a wire dome on a finished tower. A piece that
 * is new since the last draw falls into place; several new at once (a jump
 * in the replay, the opening position) land one after the other.
 */
const Tower = ({
  height,
  palette,
  introDelay,
}: {
  height: number
  palette: Palette
  /** Seconds to wait before the opening position lands on this tile. */
  introDelay: number | null
}) => {
  const floors = Math.min(height, DOME_HEIGHT - 1)
  // The height at the last draw: pieces above it are the new ones.
  const shown = useRef(introDelay === null ? height : 0)
  useEffect(() => {
    shown.current = height
  }, [height])
  const delayOf = (level: number) =>
    (introDelay ?? 0) + Math.max(0, level - shown.current) * 0.16
  return (
    <>
      {LEVELS.slice(0, floors).map((level, i) => (
        <Drop
          key={i}
          y={levelBase(i) + level.height / 2}
          delay={delayOf(i)}
          outline={{ geometry: squareOutlines[i], at: levelBase(i) }}
          palette={palette}
        >
          <mesh geometry={levelGeometry[i]}>
            <meshToonMaterial
              color={palette.towerFill}
              gradientMap={toonRamp}
              polygonOffset
              polygonOffsetFactor={1}
              polygonOffsetUnits={1}
            />
          </mesh>
          <lineSegments geometry={levelEdges[i]}>
            <lineBasicMaterial color={palette.towerInk} />
          </lineSegments>
        </Drop>
      ))}
      {height === DOME_HEIGHT && (
        <Drop
          y={levelBase(DOME_HEIGHT - 1)}
          delay={delayOf(DOME_HEIGHT - 1)}
          outline={{ geometry: outerRing, at: levelBase(DOME_HEIGHT - 1) }}
          palette={palette}
        >
          <mesh geometry={domeGeometry}>
            <meshToonMaterial
              color={palette.towerFill}
              gradientMap={toonRamp}
              polygonOffset
              polygonOffsetFactor={1}
              polygonOffsetUnits={1}
            />
          </mesh>
          <lineSegments geometry={domeWire}>
            <lineBasicMaterial color={palette.dome} />
          </lineSegments>
        </Drop>
      )}
    </>
  )
}

/**
 * Where the viewer can play: a dome's footprint in their colour, a disc in a
 * ring that pulses. A winning climb (onto level 3) gets a second ring; a
 * worker that can be picked gets the ring alone. A build shows the footprint
 * of what it would add: a square for the next floor, the circle for a dome.
 * Markers pop up in a wave when they appear.
 */
const Marker = ({
  palette,
  filled,
  winning,
  hovered,
  floor,
  delay,
}: {
  palette: Palette
  filled: boolean
  winning: boolean
  hovered: boolean
  /** The level a build here would add (0 to 2), or undefined for a round marker. */
  floor?: number
  /** Seconds before it pops up. */
  delay: number
}) => {
  const disc = useRef<Mesh>(null)
  const pop = useRef<Group>(null)
  const group = useRef<Group>(null)
  const { reduced } = useBoardMotion()
  const since = useSinceMount(delay)
  useFrame(({ clock }) => {
    const pulse = reduced ? 0.5 : (Math.sin(clock.elapsedTime * 3) + 1) / 2
    if (pop.current) {
      const p = clamp01(since(clock.elapsedTime) / 0.3)
      pop.current.visible = p > 0
      pop.current.scale.setScalar(Math.max(0.001, easeOutBack(p)))
    }
    if (disc.current) {
      const material = disc.current.material as MeshBasicMaterial
      material.opacity = hovered ? 0.85 : 0.3 + 0.35 * pulse
    }
    if (group.current && winning)
      group.current.scale.setScalar(1 + 0.08 * pulse)
  })
  return (
    <group ref={pop} visible={reduced}>
      <group ref={group} position={[0, 0.015, 0]}>
        <lineLoop
          geometry={floor === undefined ? innerRing : squareOutlines[floor]}
        >
          <lineBasicMaterial color={palette.mine} />
        </lineLoop>
        {winning && (
          <lineLoop geometry={outerRing}>
            <lineBasicMaterial color={palette.mine} />
          </lineLoop>
        )}
        {filled && (
          <mesh
            ref={disc}
            geometry={floor === undefined ? discGeometry : squareFills[floor]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshBasicMaterial
              color={palette.mine}
              transparent
              opacity={0.45}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
    </group>
  )
}

const tileCentre = ({ x, y }: Position, height: number) =>
  new Vector3(worldX(x), topOf(height), worldZ(y))

/** Seconds a worker takes to drop onto the board when it is placed. */
const PLACE_SECONDS = 0.45

interface Flight {
  from: Vector3
  to: Vector3
  start: number
  duration: number
  /** How high the arc rises above the higher end. 0 is a straight drop. */
  arc: number
}

/**
 * A worker: a spinning wire gem, faster and bobbing while it is selected.
 * It hops in an arc from square to square, drops in when it is placed,
 * squashes as it lands, and pings a ring when it is picked. The winner
 * floats up and spins.
 */
const Worker = ({
  color,
  tile,
  height,
  selected,
  selectable,
  winner,
  delay,
  palette,
  onClick,
}: {
  color: string
  tile: Position
  /** The height of the tile it stands on. */
  height: number
  selected: boolean
  selectable: boolean
  winner: boolean
  /** Seconds to wait before dropping in (for the opening position). */
  delay: number
  palette: Palette
  onClick: () => void
}) => {
  const body = useRef<Group>(null)
  const gem = useRef<Group>(null)
  const landing = useRef<LineLoop>(null)
  const ping = useRef<LineLoop>(null)
  const [hover, setHover] = useState(false)
  const { reduced } = useBoardMotion()
  const offset = useMemo(() => Math.random() * Math.PI * 2, [])

  const target = useRef(tileCentre(tile, height))
  target.current.copy(tileCentre(tile, height))
  const motion = useRef<{
    position: Vector3 | null
    flight: Flight | null
    landedAt: number
    pickedAt: number
    wasSelected: boolean
    spin: number
    speed: number
    lift: number
  }>({
    position: null,
    flight: null,
    landedAt: -Infinity,
    pickedAt: -Infinity,
    wasSelected: selected,
    spin: offset,
    speed: 0.6,
    lift: 0,
  })

  useFrame(({ clock }, delta) => {
    const m = motion.current
    const t = clock.elapsedTime
    const to = target.current
    if (!m.position) {
      m.position = to.clone()
      if (!reduced) {
        m.flight = {
          from: to.clone().setY(to.y + 2.4),
          to: to.clone(),
          start: t + delay,
          duration: PLACE_SECONDS,
          arc: 0,
        }
      }
    } else if (!(m.flight?.to ?? m.position).equals(to)) {
      if (reduced) {
        m.position.copy(to)
        m.flight = null
      } else {
        const distance = Math.hypot(to.x - m.position.x, to.z - m.position.z)
        m.flight = {
          from: m.position.clone(),
          to: to.clone(),
          start: t,
          duration: Math.min(0.75, 0.38 + 0.1 * distance),
          arc: 0.35 + 0.12 * distance,
        }
      }
    }

    const f = m.flight
    let waiting = false
    if (f) {
      const p = (t - f.start) / f.duration
      if (p < 0) {
        waiting = true
        m.position.copy(f.from)
      } else if (p >= 1) {
        m.position.copy(f.to)
        m.flight = null
        m.landedAt = t
      } else if (f.arc === 0) {
        // Placed: a fall that speeds up, like a dropped piece.
        m.position.lerpVectors(f.from, f.to, p * p)
      } else {
        const e = easeInOutCubic(p)
        m.position.lerpVectors(f.from, f.to, e)
        m.position.y += f.arc * 4 * e * (1 - e)
      }
    }

    if (selected && !m.wasSelected) m.pickedAt = t
    m.wasSelected = selected

    if (body.current) {
      body.current.visible = !waiting
      body.current.position.copy(m.position)
      // A squash as it lands, then back to shape.
      const q = (t - m.landedAt) / 0.22
      const squash = q >= 0 && q < 1 ? Math.sin(q * Math.PI) * 0.28 : 0
      body.current.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5)
    }
    if (gem.current) {
      const speed = reduced ? 0 : winner ? 7 : selected ? 2.5 : 0.6
      m.speed += (speed - m.speed) * Math.min(1, delta * 4)
      m.spin += m.speed * delta
      gem.current.rotation.y = m.spin
      const lift = winner ? 0.32 : selected ? 0.04 : 0
      m.lift += (lift - m.lift) * Math.min(1, delta * 6)
      const bob =
        reduced || (!selected && !winner)
          ? 0
          : Math.sin(t * (winner ? 3 : 4)) * (winner ? 0.07 : 0.05)
      gem.current.position.y = 0.28 + m.lift + bob
    }
    landing.current?.position.copy(to).setY(to.y + 0.02)
    animateRipple(landing.current, t - m.landedAt, 0.45, 0.9)
    ping.current?.position.copy(m.position).setY(m.position.y + 0.02)
    animateRipple(ping.current, t - m.pickedAt, 0.6, 1.1)
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!selectable) return
    event.stopPropagation()
    onClick()
  }
  const blending = palette.glow ? AdditiveBlending : NormalBlending
  return (
    <>
      <group ref={body} visible={false}>
        <group
          ref={gem}
          onClick={handleClick}
          onPointerEnter={() => selectable && setHover(true)}
          onPointerLeave={() => setHover(false)}
        >
          <lineSegments geometry={gemWire} scale={hover ? 1.15 : 1}>
            <lineBasicMaterial color={color} />
          </lineSegments>
          <mesh geometry={gemFill} scale={hover ? 1.15 : 1}>
            <meshBasicMaterial color={color} transparent opacity={0.55} />
          </mesh>
          {/* Larger than it looks: the gem is small, a finger is not. */}
          <mesh scale={1.8}>
            <octahedronGeometry args={[0.2, 0]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      </group>
      {[landing, ping].map((ref, i) => (
        <lineLoop key={i} ref={ref} geometry={innerRing} visible={false}>
          <lineBasicMaterial
            color={color}
            transparent
            opacity={0}
            blending={blending}
            depthWrite={false}
          />
        </lineLoop>
      ))}
    </>
  )
}

/** Streaks thrown up by each burst of the win. */
const SPARKS = 56
const SPARK_LIFE = 1.5
const BURSTS = 3
const BURST_EVERY = 1.3
const BEAM_LINES = 12
const BEAM_HEIGHT = 4.5
const RISING_RINGS = 3

const beamGeometry = (() => {
  const points: number[] = []
  for (let i = 0; i < BEAM_LINES; i++) {
    const angle = (i / BEAM_LINES) * Math.PI * 2
    const [x, z] = [Math.cos(angle) * 0.3, Math.sin(angle) * 0.3]
    points.push(x, 0, z, x, BEAM_HEIGHT, z)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
  return geometry
})()

/**
 * The win: a beam of light rising from the winner's tower with rings
 * climbing it, and three bursts of sparks in the winner's colour. With
 * reduced motion only the beam is drawn, still.
 */
const Celebration = ({
  position,
  color,
  palette,
}: {
  position: Vector3
  color: string
  palette: Palette
}) => {
  const { reduced } = useBoardMotion()
  // Waits for the winning hop to land.
  const since = useSinceMount(0.5)
  const beam = useRef<LineSegments>(null)
  const rings = useRef<(LineLoop | null)[]>([])
  const sparks = useRef<LineSegments>(null)
  const sparkData = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(SPARKS * 6), 3),
    )
    return { geometry, velocity: new Float32Array(SPARKS * 3), burst: -1 }
  }, [])
  useEffect(() => () => sparkData.geometry.dispose(), [sparkData])

  useFrame(({ clock }) => {
    const s = since(clock.elapsedTime)
    const shown = reduced || s >= 0
    if (beam.current) {
      beam.current.visible = shown
      const grow = reduced ? 1 : easeOutCubic(clamp01(s / 0.6))
      beam.current.scale.set(1, Math.max(0.001, grow), 1)
      const material = beam.current.material as LineBasicMaterial
      material.opacity = reduced
        ? 0.45
        : 0.35 + 0.15 * Math.sin(clock.elapsedTime * 9) * Math.sin(s * 2.3)
    }
    rings.current.forEach((ring, i) => {
      if (!ring) return
      const material = ring.material as LineBasicMaterial
      if (reduced) {
        ring.visible = true
        ring.position.y = 0.6 + i * 0.7
        material.opacity = 0.5
        return
      }
      const p = (s / 1.8 + i / RISING_RINGS) % 1
      ring.visible = s >= 0
      ring.position.y = 0.1 + p * (BEAM_HEIGHT - 1)
      ring.scale.setScalar(1.6 - p * 0.9)
      material.opacity = Math.sin(p * Math.PI) * 0.8
    })

    const lines = sparks.current
    if (!lines) return
    const burst = Math.floor(s / BURST_EVERY)
    const age = s - burst * BURST_EVERY
    lines.visible = !reduced && s >= 0 && burst < BURSTS && age < SPARK_LIFE
    if (!lines.visible) return
    const { velocity } = sparkData
    if (burst !== sparkData.burst) {
      sparkData.burst = burst
      for (let i = 0; i < SPARKS; i++) {
        const angle = Math.random() * Math.PI * 2
        const up = 2.2 + Math.random() * 2.6
        const out = 0.8 + Math.random() * 1.8
        velocity.set([Math.cos(angle) * out, up, Math.sin(angle) * out], i * 3)
      }
    }
    const positions = sparkData.geometry.getAttribute(
      'position',
    ) as Float32BufferAttribute
    const gravity = -5.5
    for (let i = 0; i < SPARKS; i++) {
      const [vx, vy, vz] = velocity.subarray(i * 3, i * 3 + 3)
      const at = (time: number) => [
        vx * time,
        0.4 + vy * time + 0.5 * gravity * time * time,
        vz * time,
      ]
      const head = at(age)
      const tail = at(Math.max(0, age - 0.07))
      positions.setXYZ(i * 2, head[0], head[1], head[2])
      positions.setXYZ(i * 2 + 1, tail[0], tail[1], tail[2])
    }
    positions.needsUpdate = true
    ;(lines.material as LineBasicMaterial).opacity = 1 - (age / SPARK_LIFE) ** 2
  })

  const blending = palette.glow ? AdditiveBlending : NormalBlending
  return (
    <group position={position}>
      <lineSegments ref={beam} geometry={beamGeometry} visible={reduced}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          blending={blending}
          depthWrite={false}
        />
      </lineSegments>
      {Array.from({ length: RISING_RINGS }, (_, i) => (
        <lineLoop
          key={i}
          ref={(ring) => {
            rings.current[i] = ring
          }}
          geometry={outerRing}
          visible={false}
        >
          <lineBasicMaterial
            color={color}
            transparent
            opacity={0}
            blending={blending}
            depthWrite={false}
          />
        </lineLoop>
      ))}
      <lineSegments
        ref={sparks}
        geometry={sparkData.geometry}
        visible={false}
        frustumCulled={false}
      >
        <lineBasicMaterial
          color={color}
          transparent
          opacity={1}
          blending={blending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

interface TileProps {
  x: number
  y: number
  height: number
  palette: Palette
  hovered: boolean
  selectedWorker: boolean
  canClickTile: boolean
  /** A click here builds (rather than places or moves). */
  buildsHere: boolean
  winningMove: boolean
  canSelectWorker: boolean
  canPerformActions: boolean
  /** Seconds before the opening position lands here, or null after it. */
  introDelay: number | null
  onTileClick: (tile: Position) => void
  onTileHover: (tile: Position | null) => void
}

const Tile = ({
  x,
  y,
  height,
  palette,
  hovered,
  selectedWorker,
  canClickTile,
  buildsHere,
  winningMove,
  canSelectWorker,
  canPerformActions,
  introDelay,
  onTileClick,
  onTileHover,
}: TileProps) => {
  const clickable = canPerformActions && canClickTile
  const selectable = canPerformActions && canSelectWorker
  const top = topOf(height)
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!clickable) return
    // Only the nearest tile under the pointer takes the click.
    event.stopPropagation()
    onTileClick({ x, y })
  }
  // Markers pop up in a wave across the board; where to build, once the
  // worker has landed from its hop.
  const markerDelay = (x + y) * 0.03 + (buildsHere ? 0.4 : 0)
  return (
    <group position={[worldX(x), 0, worldZ(y)]}>
      <Tower height={height} palette={palette} introDelay={introDelay} />
      {/* The invisible square on top of the tile (or its tower) that takes clicks. */}
      <mesh
        position={[0, top + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleClick}
        onPointerEnter={() => clickable && onTileHover({ x, y })}
        onPointerLeave={() => clickable && onTileHover(null)}
      >
        <planeGeometry args={[0.96, 0.96]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group position={[0, top, 0]}>
        {clickable && (
          <Marker
            palette={palette}
            filled
            winning={winningMove}
            floor={buildsHere && height < DOME_HEIGHT - 1 ? height : undefined}
            hovered={hovered}
            delay={markerDelay}
          />
        )}
        {(selectable || selectedWorker) && !clickable && (
          <Marker
            palette={palette}
            filled={false}
            winning={false}
            hovered={false}
            delay={markerDelay}
          />
        )}
      </group>
    </group>
  )
}

/** Keeps the whole board in view, whatever the shape of the canvas. */
const FitCamera = () => {
  const { camera, size } = useThree()
  useEffect(() => {
    if (!('isOrthographicCamera' in camera)) return
    // The board is wider than it is tall from this angle.
    camera.zoom = Math.min(size.width / 8.8, size.height / 7.2)
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

const Scene = ({
  gameState,
  nextActionType,
  playerId,
  canPerformActions,
  onTileClick,
  onWorkerClick,
  palette,
}: BoardProps & { palette: Palette }) => {
  const [hoveredTile, setHoveredTile] = useState<Position | null>(null)
  const reduced = useReducedMotion()
  // Whatever is on the board when it first draws lands piece by piece.
  const intro = useRef(true)
  useEffect(() => {
    intro.current = false
  }, [])
  const motion = useMemo(() => ({ reduced, intro }), [reduced])

  const selectedWorkerTile = gameState.currentTurn.actions.find(
    (action) => action.type === 'select_worker',
  )?.tile
  // Once it has moved, the selected worker is where the move took it.
  const movedTo = gameState.currentTurn.actions.find(
    (action) => action.type === 'move_worker',
  )?.tile
  const selectedTile = movedTo ?? selectedWorkerTile

  const heightAt = ({ x, y }: Position) => gameState.board[y][x].height
  const can = (type: ActionType, tile: Position) =>
    canExecuteAction(gameState, { type, tile, playerId }, nextActionType)
  const colorOf = (worker: WorkerPiece) =>
    worker.playerId === playerId ? palette.mine : palette.theirs
  // Only a win puts a worker on the third level: moving there ends the game.
  const winner =
    gameState.phase === 'move_and_build'
      ? gameState.workers.find(
          (worker) => heightAt(worker.position) === WINNING_HEIGHT,
        )
      : undefined

  return (
    <BoardMotionContext.Provider value={motion}>
      <color attach="background" args={[palette.background]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[-4, 9, 3]} intensity={1.8} />
      <Grid palette={palette} />
      <Coordinates palette={palette} />
      {gameState.board.map((row, y) =>
        row.map((tile, x) => {
          const canMove = can('move_worker', { x, y })
          const canBuild = can('build_from_worker', { x, y })
          return (
            <Tile
              key={`${y}-${x}`}
              x={x}
              y={y}
              height={tile.height}
              palette={palette}
              hovered={hoveredTile?.x === x && hoveredTile.y === y}
              selectedWorker={selectedTile?.x === x && selectedTile.y === y}
              canClickTile={
                can('place_worker', { x, y }) || canMove || canBuild
              }
              buildsHere={canBuild}
              winningMove={canMove && tile.height === DOME_HEIGHT - 1}
              canSelectWorker={can('select_worker', { x, y })}
              canPerformActions={canPerformActions}
              introDelay={
                intro.current ? (x + (BOARD_SIZE - 1 - y)) * 0.05 : null
              }
              onTileClick={onTileClick}
              onTileHover={setHoveredTile}
            />
          )
        }),
      )}
      {/* Workers keep their place in the list (placed in order, moved in
          place), so each one is the same piece from turn to turn and can hop. */}
      {gameState.workers.map((worker, index) => (
        <Worker
          key={index}
          color={colorOf(worker)}
          tile={worker.position}
          height={heightAt(worker.position)}
          selected={
            selectedTile?.x === worker.position.x &&
            selectedTile.y === worker.position.y
          }
          selectable={
            canPerformActions && can('select_worker', worker.position)
          }
          winner={worker === winner}
          delay={intro.current ? 0.7 + index * 0.12 : 0}
          palette={palette}
          onClick={() => onWorkerClick(worker)}
        />
      ))}
      {winner && (
        <Celebration
          key={`${winner.position.x}-${winner.position.y}`}
          position={tileCentre(winner.position, WINNING_HEIGHT)}
          color={colorOf(winner)}
          palette={palette}
        />
      )}
      {/* Drag to look around; never from below the board or from too far. */}
      <OrbitControls
        target={[0, 0.1, 0.2]}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.15}
        minZoom={30}
        maxZoom={260}
      />
      <FitCamera />
    </BoardMotionContext.Provider>
  )
}

const SantoriniBoard = (props: BoardProps) => {
  const theme = useSiteTheme()
  const palette = PALETTES[theme]
  return (
    <div className="relative h-full w-full">
      <Canvas
        id="santorini-canvas"
        orthographic
        dpr={[1, 2]}
        flat
        camera={{ position: [6, 8, 9], near: 0.1, far: 100 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.1, 0.2)}
      >
        <Scene {...props} palette={palette} />
      </Canvas>
      {/* Scanlines, as on the vector screens this is drawn after. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{
          opacity: palette.scanlines / 0.28,
          background:
            'repeating-linear-gradient(to bottom, rgba(0,0,0,.28) 0 1px, transparent 1px 3px)',
        }}
      />
    </div>
  )
}

export default SantoriniBoard
