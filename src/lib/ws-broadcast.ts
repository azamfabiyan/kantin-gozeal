// Broadcast events to the websocket mini-service via HTTP
// The WS service runs on port 3001 and exposes POST /emit

const WS_SERVICE_URL = 'http://localhost:3001'

type EventType = 'pickup:created' | 'variant:updated' | 'employee:changed' | 'period:reset'

export async function broadcastEvent(event: EventType, payload: unknown): Promise<void> {
  try {
    await fetch(`${WS_SERVICE_URL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload }),
    })
  } catch (e) {
    // WS service might not be running - fail silently
    console.error('[ws-broadcast] failed to emit', event, e)
  }
}
