import Gun from 'gun/gun';
import 'gun/sea';
import 'gun/axe';
import { signal, effect } from '@preact/signals-core';
import { 
  currentPlayer, 
  gameOver, 
  winner, 
  loser, 
  bombIndex, 
  switchStates, 
  gameStarted, 
  message,
  players,
  resetGame as localResetGame,
  pressSwitch as localPressSwitch
} from './gameState.js';

// Initialize GUN with public relay servers
const gun = Gun(['https://gun-manhattan.herokuapp.com/gun', 'https://gun-us.herokuapp.com/gun']);

// Room management
export const roomCode = signal('');
export const isHost = signal(false);
export const isConnected = signal(false);
export const playerName = signal('');
export const roomPlayers = signal([]);
export const localPlayerId = signal('');

// Generate a unique player ID
function generatePlayerId() {
  return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize local player
localPlayerId.value = generatePlayerId();

// Create or join a room
export function createRoom() {
  const code = Math.random().toString(36).substr(2, 6).toUpperCase();
  roomCode.value = code;
  isHost.value = true;
  joinRoom(code);
  return code;
}

export function joinRoom(code) {
  if (!code) return;
  
  roomCode.value = code.toUpperCase();
  isConnected.value = true;
  
  const room = gun.get(`switch-game-room-${roomCode.value}`);
  
  // Subscribe to game state changes
  room.get('gameState').on((data) => {
    if (data && !isHost.value) {
      // Update local state from multiplayer data
      if (data.currentPlayer !== undefined) currentPlayer.value = data.currentPlayer;
      if (data.gameOver !== undefined) gameOver.value = data.gameOver;
      if (data.winner !== undefined) winner.value = data.winner;
      if (data.loser !== undefined) loser.value = data.loser;
      if (data.bombIndex !== undefined) bombIndex.value = data.bombIndex;
      if (data.switchStates !== undefined) switchStates.value = data.switchStates;
      if (data.gameStarted !== undefined) gameStarted.value = data.gameStarted;
      if (data.message !== undefined) message.value = data.message;
    }
  });
  
  // Subscribe to player list changes
  room.get('players').on((data) => {
    if (data) {
      const playerList = Object.values(data).filter(p => p && typeof p === 'object');
      roomPlayers.value = playerList;
      
      // Update the game players list with actual player names
      const activePlayerNames = playerList
        .filter(p => p.active)
        .map(p => p.name)
        .slice(0, 4); // Max 4 players
      
      if (activePlayerNames.length > 0) {
        players.value = activePlayerNames;
      }
    }
  });
  
  // Add current player to room
  const playerData = {
    id: localPlayerId.value,
    name: playerName.value || `Player ${localPlayerId.value.substr(-4)}`,
    active: true,
    joinedAt: Date.now()
  };
  
  room.get('players').get(localPlayerId.value).put(playerData);
  
  // Handle disconnect on page unload
  window.addEventListener('beforeunload', () => {
    room.get('players').get(localPlayerId.value).put({
      ...playerData,
      active: false
    });
  });
}

// Sync local state to multiplayer
function syncGameState() {
  if (!isConnected.value || !roomCode.value) return;
  if (!isHost.value) return; // Only host can update game state
  
  const room = gun.get(`switch-game-room-${roomCode.value}`);
  
  room.get('gameState').put({
    currentPlayer: currentPlayer.value,
    gameOver: gameOver.value,
    winner: winner.value,
    loser: loser.value,
    bombIndex: bombIndex.value,
    switchStates: switchStates.value,
    gameStarted: gameStarted.value,
    message: message.value,
    timestamp: Date.now()
  });
}

// Override local game functions with multiplayer versions
export function resetGameMultiplayer() {
  if (!isConnected.value) {
    localResetGame();
    return;
  }
  
  if (isHost.value) {
    localResetGame();
    syncGameState();
  } else {
    // Request host to reset game
    const room = gun.get(`switch-game-room-${roomCode.value}`);
    room.get('requests').get('reset').put({
      from: localPlayerId.value,
      timestamp: Date.now()
    });
  }
}

export function pressSwitchMultiplayer(index) {
  if (!isConnected.value) {
    return localPressSwitch(index);
  }
  
  // Check if it's this player's turn
  const currentPlayerName = players.value[currentPlayer.value % players.value.length];
  const myName = playerName.value || `Player ${localPlayerId.value.substr(-4)}`;
  
  if (currentPlayerName !== myName && isConnected.value) {
    message.value = `It's ${currentPlayerName}'s turn!`;
    return false;
  }
  
  if (isHost.value) {
    const result = localPressSwitch(index);
    syncGameState();
    return result;
  } else {
    // Send switch press to host
    const room = gun.get(`switch-game-room-${roomCode.value}`);
    room.get('requests').get('press').put({
      from: localPlayerId.value,
      index: index,
      timestamp: Date.now()
    });
  }
}

// Listen for requests if host
if (isHost.value) {
  effect(() => {
    if (!roomCode.value) return;
    
    const room = gun.get(`switch-game-room-${roomCode.value}`);
    
    // Listen for reset requests
    room.get('requests').get('reset').on((data) => {
      if (data && data.timestamp > Date.now() - 5000) {
        localResetGame();
        syncGameState();
      }
    });
    
    // Listen for press requests
    room.get('requests').get('press').on((data) => {
      if (data && data.timestamp > Date.now() - 5000) {
        localPressSwitch(data.index);
        syncGameState();
      }
    });
  });
}

// Auto-sync when local state changes (host only)
effect(() => {
  if (isHost.value && isConnected.value) {
    // Trigger sync on any state change
    const trigger = [
      currentPlayer.value,
      gameOver.value,
      winner.value,
      loser.value,
      bombIndex.value,
      switchStates.value,
      gameStarted.value,
      message.value
    ];
    syncGameState();
  }
});