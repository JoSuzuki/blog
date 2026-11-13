import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { EffectComposer, Scanline } from '@react-three/postprocessing'
import { useState } from 'react'
import { BoxGeometry, Color } from 'three'
import { DOME_HEIGHT, canExecuteAction } from '~/lib/santorini/game'
import type {
  ActionType,
  GameState,
  Position,
  Worker as WorkerPiece,
} from '~/lib/santorini/game'

// The 3D board, ported from mazeps (app/components/santorini). It only draws
// the state it is given and reports clicks; the rules live in
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

const TILE_SIZE = 3
const BUILDING_SIZE = 2.5
const BUILDING_HEIGHT = 2

const tileOutline = new BoxGeometry(TILE_SIZE, 0, TILE_SIZE, 1, 2, 1)
const skyColor = new Color(0x7fc8f8)

interface GridTileProps {
  x: number
  y: number
  height: number
  worker: WorkerPiece | undefined
  playerId: number
  hovered: boolean
  selectedWorker: boolean
  canClickTile: boolean
  canSelectWorker: boolean
  canPerformActions: boolean
  onTileClick: (tile: Position) => void
  onTileHover: (tile: Position | null) => void
  onWorkerClick: (worker: WorkerPiece) => void
}

const GridTile = ({
  x,
  y,
  height,
  worker,
  playerId,
  hovered,
  selectedWorker,
  canClickTile,
  canSelectWorker,
  canPerformActions,
  onTileClick,
  onTileHover,
  onWorkerClick,
}: GridTileProps) => {
  const clickable = canPerformActions && canClickTile
  return (
    <group
      position={[
        x * TILE_SIZE - TILE_SIZE * 2,
        0.03,
        y * TILE_SIZE - TILE_SIZE * 2,
      ]}
    >
      <lineSegments>
        <edgesGeometry args={[tileOutline]} />
        <lineBasicMaterial color="white" />
      </lineSegments>
      <Tile
        height={height}
        hovered={hovered}
        clickable={clickable}
        onClick={() => onTileClick({ x, y })}
        onHover={(over) => onTileHover(over ? { x, y } : null)}
      />
      <Building height={height} />
      {worker && (
        <Worker
          color={worker.playerId === playerId ? 0xff0000 : 0x0000ff}
          height={height}
          selected={selectedWorker}
          selectable={canPerformActions && canSelectWorker}
          onClick={() => onWorkerClick(worker)}
        />
      )}
    </group>
  )
}

/** The invisible square on top of a tile (or its building) that takes clicks. */
const Tile = ({
  height,
  hovered,
  clickable,
  onClick,
  onHover,
}: {
  height: number
  hovered: boolean
  clickable: boolean
  onClick: () => void
  onHover: (over: boolean) => void
}) => {
  const size = height === 0 ? TILE_SIZE : BUILDING_SIZE + 0.1
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!clickable) return
    // Only the nearest tile under the pointer takes the click.
    event.stopPropagation()
    onClick()
  }
  return (
    <mesh
      position={[0, height * BUILDING_HEIGHT + 0.01, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleClick}
      onPointerEnter={() => clickable && onHover(true)}
      onPointerLeave={() => clickable && onHover(false)}
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color={hovered ? 0xffff00 : 0xffffff}
        transparent
        opacity={clickable ? 0.5 : 0}
      />
    </mesh>
  )
}

const Worker = ({
  color,
  height,
  selected,
  selectable,
  onClick,
}: {
  color: number
  height: number
  selected: boolean
  selectable: boolean
  onClick: () => void
}) => {
  const [hover, setHover] = useState(false)
  const highlight = hover || selected ? 0xff69b4 : 0xffff00
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!selectable) return
    event.stopPropagation()
    onClick()
  }
  return (
    <group
      position={[0, 0.75 + height * BUILDING_HEIGHT + 0.02, 0]}
      // Turned so that no edge of the cone lies on the board's axes. With an
      // edge exactly under the pointer (a worker in the middle column, seen
      // from straight above, clicked on its centre line) the ray can slip
      // between the two faces and the click is lost.
      rotation={[0, 0.4, 0]}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onClick={handleClick}
    >
      <mesh>
        <coneGeometry args={[0.5, 1.5, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {(selectable || selected) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.75, 0]}>
          <circleGeometry args={[0.6, 24]} />
          <meshStandardMaterial
            color={highlight}
            emissive={highlight}
            emissiveIntensity={1}
          />
        </mesh>
      )}
    </group>
  )
}

/** Up to three white floors, and a blue dome on a finished tower. */
const Building = ({ height }: { height: number }) => {
  if (height === 0) return null
  const floors = Math.min(height, DOME_HEIGHT - 1)
  return (
    <>
      <mesh position={[0, (floors * BUILDING_HEIGHT) / 2, 0]}>
        <boxGeometry
          args={[BUILDING_SIZE, floors * BUILDING_HEIGHT, BUILDING_SIZE]}
        />
        <meshStandardMaterial
          color={0xffffff}
          emissive={0xffffff}
          emissiveIntensity={0.5}
        />
      </mesh>
      {height === DOME_HEIGHT && (
        <mesh position={[0, floors * BUILDING_HEIGHT, 0]}>
          <sphereGeometry
            args={[1.1, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial color={0x0000ff} />
        </mesh>
      )}
    </>
  )
}

/** The green field with its white border, on a brown island. */
const Island = () => (
  <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <planeGeometry args={[15, 15]} />
      <meshStandardMaterial color={0xffffff} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <planeGeometry args={[14.75, 14.75]} />
      <meshStandardMaterial color={0x50ff50} />
    </mesh>
    <mesh position={[0, -1.5, 0]}>
      <cylinderGeometry args={[12, 17, 3, 10]} />
      <meshStandardMaterial color={0x9a6d38} />
    </mesh>
  </>
)

const Scene = ({
  gameState,
  nextActionType,
  playerId,
  canPerformActions,
  onTileClick,
  onWorkerClick,
}: BoardProps) => {
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
      {gameState.board.map((row, y) =>
        row.map((tile, x) => {
          const can = (type: ActionType) =>
            canExecuteAction(
              gameState,
              { type, tile: { x, y }, playerId },
              nextActionType,
            )
          return (
            <GridTile
              key={`${y}-${x}`}
              x={x}
              y={y}
              height={tile.height}
              worker={gameState.workers.find(
                (worker) => worker.position.x === x && worker.position.y === y,
              )}
              playerId={playerId}
              hovered={hoveredTile?.x === x && hoveredTile.y === y}
              selectedWorker={selectedTile?.x === x && selectedTile.y === y}
              canClickTile={
                can('place_worker') ||
                can('move_worker') ||
                can('build_from_worker')
              }
              canSelectWorker={can('select_worker')}
              canPerformActions={canPerformActions}
              onTileClick={onTileClick}
              onTileHover={setHoveredTile}
              onWorkerClick={onWorkerClick}
            />
          )
        }),
      )}
      <Island />
      <EffectComposer>
        <Scanline density={2} />
      </EffectComposer>
      <hemisphereLight intensity={2} groundColor={0x9a6d38} color={0xffffff} />
      {/* Drag to look around; never from below the island or from too far. */}
      <OrbitControls
        maxPolarAngle={Math.PI / 2.05}
        minDistance={12}
        maxDistance={60}
      />
    </>
  )
}

const SantoriniBoard = (props: BoardProps) => (
  <Canvas
    id="santorini-canvas"
    // Straight above the board, as in mazeps, but with a narrower lens: the
    // canvas here is a box in the page, not the whole screen.
    camera={{ position: [0, 30, 0], fov: 45 }}
    scene={{ background: skyColor }}
  >
    <Scene {...props} />
  </Canvas>
)

export default SantoriniBoard
