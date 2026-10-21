'use client'

import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'

type EventMap = {
  'pickup:created': (payload: unknown) => void
  'variant:updated': (payload: unknown) => void
  'employee:changed': (payload: unknown) => void
  'period:reset': (payload: unknown) => void
}

export function useWebSocket(handlers: Partial<EventMap>) {
  const socketRef = useRef<Socket | null>(null)
  const handlersRef = useRef<Partial<EventMap>>(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    const socket = io('/?XTransformPort=3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    const allEvents: (keyof EventMap)[] = [
      'pickup:created', 'variant:updated', 'employee:changed', 'period:reset',
    ]
    allEvents.forEach((event) => {
      socket.on(event, (payload: unknown) => {
        const handler = handlersRef.current[event]
        if (handler) handler(payload)
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  return socketRef
}
