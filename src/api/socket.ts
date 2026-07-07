import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL, getAuthToken } from './client';

/**
 * El namespace `/judge` valida la sesión en el handshake (ver
 * `JudgeGateway.afterInit` en el backend) — sin token, el servidor rechaza
 * la conexión. `/team` y `/viewer` siguen sin login, a propósito.
 */
export function connectNamespace(namespace: '/team' | '/judge' | '/viewer'): Socket {
  const auth = namespace === '/judge' ? { token: getAuthToken() } : undefined;
  return io(`${API_BASE_URL}${namespace}`, { transports: ['websocket'], auth });
}
