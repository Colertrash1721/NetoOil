'use client';

import { getRealtimeWebSocketUrl } from '@/services/api/client';
import { useEffect, useRef } from 'react';

type RealtimeMessage = {
  type?: string;
  [key: string]: unknown;
};

export function useRealtimeRefresh(
  eventTypes: string[],
  onEvent: (message: RealtimeMessage) => void,
) {
  const onEventRef = useRef(onEvent);
  const eventTypesRef = useRef(eventTypes);

  useEffect(() => {
    onEventRef.current = onEvent;
    eventTypesRef.current = eventTypes;
  }, [eventTypes, onEvent]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    let reconnectTimer: number | null = null;
    let closedByEffect = false;
    let socket: WebSocket | null = null;

    const connect = () => {
      socket = new WebSocket(getRealtimeWebSocketUrl(token));

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as RealtimeMessage;
          const type = message.type;
          if (type && eventTypesRef.current.includes(type)) {
            onEventRef.current(message);
          }
        } catch {
          // Ignore malformed realtime messages.
        }
      };

      socket.onclose = () => {
        if (!closedByEffect) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, []);
}
