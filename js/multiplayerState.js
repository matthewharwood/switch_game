import Gun from 'gun/gun';
import 'gun/sea';
import 'gun/axe';
import { signal, effect } from '@preact/signals-core';
import { setRoomCodeInURL, clearRoomFromURL } from './urlManager.js';
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

// Initialize GUN with public relay servers for peer-to-peer communication
// These are relay servers that help browsers connect to each other
const gun = Gun({
  peers: [
    'https://relay.peer.ooo/gun',  // Public relay server
    'https://gun-manhattan.herokuapp.com/gun',  // Backup relay
    'https://e2eec.herokuapp.com/gun'  // Another backup
  ],
  localStorage: false,  // Use memory instead of localStorage for better mobile support
  radisk: false
});

// Room management
export const roomCode = signal('');
export const isHost = signal(false);
export const isConnected = signal(false);
export const playerName = signal('');
export const roomPlayers = signal([]);
export const localPlayerId = signal('');
export const playerCharacter = signal('');
export const characterAssignments = signal({});
export const gameReady = signal(false);
export const roomStarted = signal(false);

console.log('Initial roomStarted value:', roomStarted.value);

// Generate a unique player ID
function generatePlayerId() {
  return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize local player
localPlayerId.value = generatePlayerId();

// Helper function to get character color
function getCharacterColor(character) {
  const colors = {
    'Mario': 'red',
    'Luigi': 'green',
    'Yoshi': 'blue',
    'Birdo': 'pink'
  };
  return colors[character] || 'gray';
}

// Create or join a room
export function createRoom() {
  const code = Math.random().toString(36).substr(2, 6).toUpperCase();
  roomCode.value = code;
  isHost.value = true;
  setRoomCodeInURL(code);
  joinRoom(code);
  return code;
}

export function joinRoom(code) {
  if (!code) return;
  
  console.log('Joining room:', code);
  roomCode.value = code.toUpperCase();
  isConnected.value = true;
  setRoomCodeInURL(code);
  
  const room = gun.get(`switch-game-room-${roomCode.value}`);
  
  // Subscribe to room started state - and get initial value
  room.get('roomStarted').once((data) => {
    console.log('Initial roomStarted value from room:', data);
    if (data !== undefined && data !== null) {
      roomStarted.value = data;
      console.log('Room started state initialized to:', roomStarted.value);
    }
  });
  
  // Subscribe to room started state changes
  room.get('roomStarted').on((data) => {
    console.log('Received roomStarted update:', data);
    if (data !== undefined && data !== null) {
      roomStarted.value = data;
      console.log('Room started state updated to:', roomStarted.value);
    }
  });
  
  // Subscribe to game state changes
  room.get('gameState').on((data) => {
    console.log('Received game state:', data);
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
  
  // Track all players in the room
  const playersMap = new Map();
  
  // First, load any existing players
  room.get('players').once((allData) => {
    if (allData) {
      Object.keys(allData).forEach(key => {
        if (!key.startsWith('_') && !key.startsWith('#') && allData[key] && allData[key].id) {
          playersMap.set(key, allData[key]);
        }
      });
      const initialPlayers = Array.from(playersMap.values()).filter(p => p && p.active);
      console.log('Initial players found:', initialPlayers);
      if (initialPlayers.length > 0) {
        roomPlayers.value = initialPlayers;
      }
    }
  });
  
  // Subscribe to individual player changes using map()
  room.get('players').map().on((data, key) => {
    if (key && !key.startsWith('_') && !key.startsWith('#')) {
      if (data && data.id) {
        // Player joined or updated
        playersMap.set(key, data);
        console.log('Player joined/updated:', key, data);
      } else {
        // Player left
        playersMap.delete(key);
        console.log('Player left:', key);
      }
      
      // Update the roomPlayers signal with current active players
      const playerList = Array.from(playersMap.values()).filter(p => p && p.active);
      console.log('Current players in room:', playerList);
      roomPlayers.value = playerList;
      
      // Assign characters to players
      const characters = ['Mario', 'Luigi', 'Yoshi', 'Birdo'];
      const activePlayers = playerList
        .filter(p => p.active)
        .sort((a, b) => a.joinedAt - b.joinedAt) // Sort by join time
        .slice(0, 4); // Max 4 players
      
      const newAssignments = {};
      activePlayers.forEach((player, index) => {
        newAssignments[player.id] = {
          name: player.name,
          character: characters[index],
          color: getCharacterColor(characters[index])
        };
        
        // Set local player's character
        if (player.id === localPlayerId.value) {
          playerCharacter.value = characters[index];
        }
      });
      
      characterAssignments.value = newAssignments;
      
      // Update the game players list with character names for display
      if (activePlayers.length > 0) {
        players.value = activePlayers.map(p => newAssignments[p.id].character);
        gameReady.value = activePlayers.length >= 2; // Need at least 2 players
      } else {
        gameReady.value = false;
      }
    }
  });
  
  // Create player data first (so it's accessible in all scopes)
  const playerData = {
    id: localPlayerId.value,
    name: playerName.value || `Player ${localPlayerId.value.substr(-4)}`,
    active: true,
    joinedAt: Date.now()
  };
  
  // Add current player to room immediately (don't wait for checks)
  console.log('Adding player to room:', playerData);
  room.get('players').get(localPlayerId.value).put(playerData);
  
  // Also add to local state immediately for instant UI feedback
  if (!roomPlayers.value.find(p => p.id === localPlayerId.value)) {
    roomPlayers.value = [...roomPlayers.value, playerData];
  }
  
  // Also add to local state immediately for instant feedback
  setTimeout(() => {
    // Give a moment for the subscription to set up, then force a refresh
    room.get('players').get(localPlayerId.value).once((data) => {
      if (!data) {
        // If our data didn't persist, try again
        console.log('Retrying player addition...');
        room.get('players').get(localPlayerId.value).put(playerData);
      }
    });
  }, 100);
  
  // Handle disconnect on page unload
  window.addEventListener('beforeunload', () => {
    if (isConnected.value && localPlayerId.value) {
      room.get('players').get(localPlayerId.value).put({
        ...playerData,
        active: false
      });
    }
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
export function startRoomGame() {
  if (!isHost.value) return;
  
  console.log('Host starting room game...');
  const room = gun.get(`switch-game-room-${roomCode.value}`);
  
  // Set roomStarted in GUN
  room.get('roomStarted').put(true);
  
  // Update local signal
  roomStarted.value = true;
  console.log('Room started set to true, roomStarted.value:', roomStarted.value);
  
  // Initialize the game
  localResetGame();
  syncGameState();
}

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
  
  // Check if it's this player's turn using character assignment
  const currentPlayerCharacter = players.value[currentPlayer.value % players.value.length];
  const myCharacter = playerCharacter.value;
  
  if (currentPlayerCharacter !== myCharacter && isConnected.value) {
    message.value = `It's ${currentPlayerCharacter}'s turn!`;
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
effect(() => {
  if (!isHost.value || !roomCode.value) return;
    
    const room = gun.get(`switch-game-room-${roomCode.value}`);
    
  // Listen for reset requests
  room.get('requests').get('reset').on((data) => {
    if (data && data.timestamp > Date.now() - 5000) {
      console.log('Host received reset request');
      localResetGame();
      syncGameState();
    }
  });
  
  // Listen for press requests
  room.get('requests').get('press').on((data) => {
    if (data && data.timestamp > Date.now() - 5000) {
      console.log('Host received press request:', data);
      localPressSwitch(data.index);
      syncGameState();
    }
  });
});

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