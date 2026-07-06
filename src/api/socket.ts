import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './client';

export function connectNamespace(namespace: '/team' | '/judge' | '/viewer'): Socket {
  return io(`${API_BASE_URL}${namespace}`, { transports: ['websocket'] });
}
