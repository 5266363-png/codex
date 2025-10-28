import { io as createClient } from 'socket.io-client';
import { BASE } from './api.js';

export const socket = createClient(BASE, {
  autoConnect: true
});
