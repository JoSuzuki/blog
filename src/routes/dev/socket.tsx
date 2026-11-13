// TEMPORARY developer page for the custom server (step 2 of the TanStack Start
// migration). It shows the socket.io handshake working end to end and that
// server functions can reach socket.io through getIO(). Step 8 deletes it.
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import Article from '~/components/article/article'
import Button from '~/components/button/button'
import ThemeButton from '~/components/theme-button/theme-button'
import { getIO } from '~/lib/io.server'
import type {
  ClientToServerEvents,
  DevBroadcastPayload,
  HelloPayload,
  PingAck,
  ServerToClientEvents,
} from '~/lib/socket-events'

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const broadcastFromServerFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const payload: DevBroadcastPayload = {
      message: 'broadcast from a server function',
      serverTime: new Date().toISOString(),
    }
    getIO().emit('dev:broadcast', payload)
    return { sockets: getIO().of('/').sockets.size, payload }
  },
)

export const Route = createFileRoute('/dev/socket')({
  head: () => ({
    meta: [
      { title: 'Socket | JoSuzuki' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: DevSocket,
})

type Status = 'connecting' | 'connected' | 'disconnected'

function DevSocket() {
  const socketRef = useRef<ClientSocket | null>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [socketId, setSocketId] = useState<string>()
  const [transport, setTransport] = useState<string>()
  const [hello, setHello] = useState<HelloPayload>()
  const [helloCount, setHelloCount] = useState(0)
  const [ack, setAck] = useState<PingAck>()
  const [serverFnResult, setServerFnResult] = useState<string>()
  const [broadcast, setBroadcast] = useState<DevBroadcastPayload>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const socket: ClientSocket = io()
    socketRef.current = socket

    const onConnect = () => {
      setStatus('connected')
      setSocketId(socket.id)
      setTransport(socket.io.engine.transport.name)
      socket.io.engine.once('upgrade', (upgraded) =>
        setTransport(upgraded.name),
      )
    }
    socket.on('connect', onConnect)
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('connect_error', (err) => setError(err.message))
    socket.on('hello', (payload) => {
      setHello(payload)
      setHelloCount((count) => count + 1)
    })
    socket.on('dev:broadcast', setBroadcast)

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const sendPing = async () => {
    const socket = socketRef.current
    if (!socket) return
    try {
      setAck(
        await socket.timeout(5000).emitWithAck('ping', { sentAt: Date.now() }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const callServerFn = async () => {
    try {
      const result = await broadcastFromServerFn()
      setServerFnResult(
        `emitted to ${result.sockets} socket(s) at ${result.payload.serverTime}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <nav className="mx-auto flex max-w-container items-center justify-between py-md">
        <h1 className="text-lg">Socket</h1>
        <ThemeButton />
      </nav>
      <Article>
        <p className="my-md text-dimmed">
          Temporary page that checks the custom server's socket.io endpoint.
        </p>
        <dl className="my-md grid grid-cols-[max-content_1fr] gap-x-md gap-y-sm">
          <Row label="Status">
            <span data-testid="status" className="text-accent">
              {status}
            </span>
          </Row>
          <Row label="Socket id">
            <code data-testid="socket-id">{socketId ?? '-'}</code>
          </Row>
          <Row label="Transport">
            <code data-testid="transport">{transport ?? '-'}</code>
          </Row>
          <Row label="Hello">
            <code data-testid="hello">
              {hello ? `${hello.message} @ ${hello.serverTime}` : '-'}
            </code>
            {helloCount > 1 && (
              <span className="text-dimmed"> (received {helloCount}×)</span>
            )}
          </Row>
          <Row label="Ping ack">
            <code data-testid="ack">
              {ack ? `${ack.message} @ ${ack.serverTime}` : '-'}
            </code>
          </Row>
          <Row label="Server fn">
            <code data-testid="server-fn">{serverFnResult ?? '-'}</code>
          </Row>
          <Row label="Broadcast">
            <code data-testid="broadcast">
              {broadcast
                ? `${broadcast.message} @ ${broadcast.serverTime}`
                : '-'}
            </code>
          </Row>
          {error && (
            <Row label="Error">
              <code data-testid="error">{error}</code>
            </Row>
          )}
        </dl>
        <div className="mt-lg flex flex-wrap gap-md">
          <Button type="button" onClick={sendPing}>
            Send ping
          </Button>
          <Button type="button" onClick={callServerFn}>
            Call server function
          </Button>
        </div>
      </Article>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="wght-semibold">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}
