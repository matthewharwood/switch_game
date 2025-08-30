// Local multiplayer fallback for testing without external servers
import { signal } from '@preact/signals-core';

// Simple in-memory store for local testing
class LocalStore {
  constructor() {
    this.rooms = new Map();
    this.listeners = new Map();
  }
  
  getRoom(roomCode) {
    if (!this.rooms.has(roomCode)) {
      this.rooms.set(roomCode, {
        gameState: {},
        players: {},
        requests: {
          reset: null,
          press: null
        }
      });
    }
    return this.rooms.get(roomCode);
  }
  
  updateRoom(roomCode, path, data) {
    const room = this.getRoom(roomCode);
    const parts = path.split('.');
    let current = room;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = data;
    
    // Notify listeners
    const roomListeners = this.listeners.get(roomCode) || [];
    roomListeners.forEach(listener => {
      if (listener.path === path || listener.path.startsWith(path)) {
        listener.callback(data);
      }
    });
  }
  
  subscribe(roomCode, path, callback) {
    if (!this.listeners.has(roomCode)) {
      this.listeners.set(roomCode, []);
    }
    this.listeners.get(roomCode).push({ path, callback });
    
    // Return current value if exists
    const room = this.getRoom(roomCode);
    const parts = path.split('.');
    let current = room;
    
    for (const part of parts) {
      current = current?.[part];
      if (!current) break;
    }
    
    if (current) {
      callback(current);
    }
  }
}

export const localStore = new LocalStore();
export const useLocalMultiplayer = signal(true); // Toggle for local testing