import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  OctahedronGeometry,
  SRGBColorSpace,
  SphereGeometry,
  Vector3,
  WireframeGeometry,
} from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import { useSiteTheme } from '~/components/taboo/theme'
import type { SiteTheme } from '~/components/taboo/theme'
import { BOARD_SIZE, DOME_HEIGHT, canExecuteAction } from '~/lib/santorini/game'
import type {
  ActionType,
  GameState,
  Position,
  Worker as WorkerPiece,
} from '~/lib/santorini/game'

// The 3D board, drawn like an old vector display: a glowing grid, light
// solid towers with an ink outline, wire domes and wire-gem workers. It only
// draws the state it is given and reports clicks; the rules live in
// ~/lib/santorini/game and every move is decided on the server.
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

/** Up to three solid floors and a wire dome on a finished tower. */
const Tower = ({ height, palette }: { height: number; palette: Palette }) => {
  const floors = Math.min(height, DOME_HEIGHT - 1)
  return (
    <>
      {LEVELS.slice(0, floors).map((level, i) => (
        <group key={i} position={[0, levelBase(i) + level.height / 2, 0]}>
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
        </group>
      ))}
      {height === DOME_HEIGHT && (
        <group position={[0, levelBase(DOME_HEIGHT - 1), 0]}>
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
        </group>
      )}
    </>
  )
}

/**
 * Where the viewer can play: a dome's footprint in their colour, a disc in a
 * ring that pulses. A winning climb (onto level 3) gets a second ring; a
 * worker that can be picked gets the ring alone.
 */
const Marker = ({
  palette,
  filled,
  winning,
  hovered,
}: {
  palette: Palette
  filled: boolean
  winning: boolean
  hovered: boolean
}) => {
  const disc = useRef<Mesh>(null)
  const group = useRef<Group>(null)
  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 3) + 1) / 2
    if (disc.current) {
      const material = disc.current.material as MeshBasicMaterial
      material.opacity = hovered ? 0.85 : 0.3 + 0.35 * pulse
    }
    if (group.current && winning)
      group.current.scale.setScalar(1 + 0.08 * pulse)
  })
  return (
    <group ref={group} position={[0, 0.015, 0]}>
      <lineLoop geometry={innerRing}>
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
          geometry={discGeometry}
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
  )
}

/** A worker: a spinning wire gem, faster and bobbing while it is selected. */
const Worker = ({
  color,
  selected,
  selectable,
  onClick,
}: {
  color: string
  selected: boolean
  selectable: boolean
  onClick: () => void
}) => {
  const gem = useRef<Group>(null)
  const [hover, setHover] = useState(false)
  const offset = useMemo(() => Math.random() * Math.PI * 2, [])
  useFrame(({ clock }) => {
    if (!gem.current) return
    const t = clock.elapsedTime
    gem.current.rotation.y = t * (selected ? 2.5 : 0.6) + offset
    gem.current.position.y =
      0.28 + (selected ? 0.04 + Math.sin(t * 4) * 0.05 : 0)
  })
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!selectable) return
    event.stopPropagation()
    onClick()
  }
  return (
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
  )
}

interface TileProps {
  x: number
  y: number
  height: number
  worker: WorkerPiece | undefined
  palette: Palette
  playerId: number
  hovered: boolean
  selectedWorker: boolean
  canClickTile: boolean
  winningMove: boolean
  canSelectWorker: boolean
  canPerformActions: boolean
  onTileClick: (tile: Position) => void
  onTileHover: (tile: Position | null) => void
  onWorkerClick: (worker: WorkerPiece) => void
}

const Tile = ({
  x,
  y,
  height,
  worker,
  palette,
  playerId,
  hovered,
  selectedWorker,
  canClickTile,
  winningMove,
  canSelectWorker,
  canPerformActions,
  onTileClick,
  onTileHover,
  onWorkerClick,
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
  return (
    <group position={[worldX(x), 0, worldZ(y)]}>
      <Tower height={height} palette={palette} />
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
            hovered={hovered}
          />
        )}
        {(selectable || selectedWorker) && !clickable && (
          <Marker
            palette={palette}
            filled={false}
            winning={false}
            hovered={false}
          />
        )}
        {worker && (
          <Worker
            color={worker.playerId === playerId ? palette.mine : palette.theirs}
            selected={selectedWorker}
            selectable={selectable}
            onClick={() => onWorkerClick(worker)}
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

  const selectedWorkerTile = gameState.currentTurn.actions.find(
    (action) => action.type === 'select_worker',
  )?.tile
  // Once it has moved, the selected worker is where the move took it.
  const movedTo = gameState.currentTurn.actions.find(
    (action) => action.type === 'move_worker',
  )?.tile
  const selectedTile = movedTo ?? selectedWorkerTile

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[-4, 9, 3]} intensity={1.8} />
      <Grid palette={palette} />
      <Coordinates palette={palette} />
      {gameState.board.map((row, y) =>
        row.map((tile, x) => {
          const can = (type: ActionType) =>
            canExecuteAction(
              gameState,
              { type, tile: { x, y }, playerId },
              nextActionType,
            )
          const canMove = can('move_worker')
          return (
            <Tile
              key={`${y}-${x}`}
              x={x}
              y={y}
              height={tile.height}
              worker={gameState.workers.find(
                (worker) => worker.position.x === x && worker.position.y === y,
              )}
              palette={palette}
              playerId={playerId}
              hovered={hoveredTile?.x === x && hoveredTile.y === y}
              selectedWorker={selectedTile?.x === x && selectedTile.y === y}
              canClickTile={
                can('place_worker') || canMove || can('build_from_worker')
              }
              winningMove={canMove && tile.height === DOME_HEIGHT - 1}
              canSelectWorker={can('select_worker')}
              canPerformActions={canPerformActions}
              onTileClick={onTileClick}
              onTileHover={setHoveredTile}
              onWorkerClick={onWorkerClick}
            />
          )
        }),
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
    </>
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
