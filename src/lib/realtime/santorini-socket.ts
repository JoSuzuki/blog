import { acquireSocket, onSocketCreated, releaseSocket } from './connection'
import type { ClientSocket } from './connection'

// Live updates for the Santorini pages, over the page's shared socket. A
// channel is `lobby` (the list of rooms) or a room's code.

const subscriptions = new Set<{ channel: string; onChange: () => void }>()

const channelsInUse = () => new Set([...subscriptions].map((s) => s.channel))

const notify = (channel: string) => {
  for (const sub of subscriptions) if (sub.channel === channel) sub.onChange()
}

const joinAndSync = (socket: ClientSocket, channel: string) => {
  socket.emit('santorini:join', channel, (ack) => {
    // Joined, first time or after a reconnection: changes made while there
    // was no connection were missed, so load again.
    if (ack.ok) notify(channel)
  })
}

onSocketCreated((socket) => {
  socket.on('connect', () => {
    for (const channel of channelsInUse()) joinAndSync(socket, channel)
  })
  socket.on('santorini:changed', ({ channel }) => notify(channel))
})

/**
 * Calls `onChange` whenever the channel's data may have changed: on every
 * `santorini:changed` event and each time the socket (re)joins the channel.
 * The event carries no data, so `onChange` should run the page's loader
 * again. Returns the function that stops.
 */
export const subscribeToSantorini = (
  channel: string,
  onChange: () => void,
): (() => void) => {
  const subscription = { channel, onChange }
  subscriptions.add(subscription)
  const socket = acquireSocket()
  if (socket.connected) joinAndSync(socket, channel)

  return () => {
    subscriptions.delete(subscription)
    if (socket.connected && !channelsInUse().has(channel)) {
      socket.emit('santorini:leave', channel)
    }
    releaseSocket()
  }
}
