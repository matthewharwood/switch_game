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
  bombHit,
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
  
  // Track last sync timestamp to avoid feedback loops
  let lastSyncTimestamp = 0;
  
  // Subscribe to game state changes
  room.get('gameState').on((data) => {
    console.log('Received game state:', data);
    if (data && data.timestamp) {
      // Skip if this is an old update we've already processed
      if (data.timestamp <= lastSyncTimestamp) {
        console.log('Skipping old game state update');
        return;
      }
      lastSyncTimestamp = data.timestamp;
      
      // Update local state from multiplayer data for all players
      // This ensures everyone stays in sync
      if (data.currentPlayer !== undefined) currentPlayer.value = data.currentPlayer;
      if (data.gameOver !== undefined) gameOver.value = data.gameOver;
      if (data.winner !== undefined) winner.value = data.winner;
      if (data.loser !== undefined) loser.value = data.loser;
      if (data.bombIndex !== undefined) bombIndex.value = data.bombIndex;
      if (data.switchStates !== undefined) {
        try {
          const parsedStates = typeof data.switchStates === 'string' 
            ? JSON.parse(data.switchStates) 
            : data.switchStates;
          console.log('Updating switch states:', parsedStates);
          switchStates.value = parsedStates;
        } catch (e) {
          console.error('Failed to parse switch states:', e);
        }
      }
      if (data.gameStarted !== undefined) gameStarted.value = data.gameStarted;
      if (data.message !== undefined) message.value = data.message;
      if (data.players !== undefined) {
        try {
          const parsedPlayers = typeof data.players === 'string'
            ? JSON.parse(data.players)
            : data.players;
          players.value = parsedPlayers;
        } catch (e) {
          console.error('Failed to parse players:', e);
        }
      }
      if (data.bombHit !== undefined) bombHit.value = data.bombHit;
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
  
  const stateToSync = {
    currentPlayer: currentPlayer.value,
    gameOver: gameOver.value,
    winner: winner.value,
    loser: loser.value,
    bombIndex: bombIndex.value,
    switchStates: JSON.stringify(switchStates.value), // Serialize array for GUN
    gameStarted: gameStarted.value,
    message: message.value,
    players: JSON.stringify(players.value), // Serialize array for GUN
    bombHit: bombHit.value, // Sync bomb hit for sound
    timestamp: Date.now()
  };
  
  console.log('Host syncing game state:', stateToSync);
  room.get('gameState').put(stateToSync);
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
  // Force immediate sync after starting game
  setTimeout(() => syncGameState(), 50);
}

export function resetGameMultiplayer() {
  if (!isConnected.value) {
    localResetGame();
    return;
  }
  
  if (isHost.value) {
    console.log('Host resetting game');
    localResetGame();
    // Force immediate sync after reset
    setTimeout(() => syncGameState(), 50);
  } else {
    // Request host to reset game
    console.log('Requesting host to reset game');
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
  
  console.log('Press switch attempt:', {
    index,
    currentPlayerCharacter,
    myCharacter,
    isMyTurn: currentPlayerCharacter === myCharacter,
    currentPlayer: currentPlayer.value,
    players: players.value
  });
  
  if (currentPlayerCharacter !== myCharacter && isConnected.value) {
    message.value = `It's ${currentPlayerCharacter}'s turn!`;
    return false;
  }
  
  if (isHost.value) {
    console.log('Host pressing switch:', index);
    const result = localPressSwitch(index);
    console.log('Press result:', result, 'New state:', {
      currentPlayer: currentPlayer.value,
      switchStates: switchStates.value
    });
    // Immediate sync after press
    setTimeout(() => syncGameState(), 50);
    return result;
  } else {
    // Send switch press to host
    console.log('Sending press request to host:', index);
    const room = gun.get(`switch-game-room-${roomCode.value}`);
    room.get('requests').get('press').put({
      from: localPlayerId.value,
      character: myCharacter,
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
      // Immediate sync after reset
      setTimeout(() => syncGameState(), 50);
    }
  });
  
  // Listen for press requests
  room.get('requests').get('press').on((data) => {
    if (data && data.timestamp > Date.now() - 5000) {
      console.log('Host received press request:', data);
      
      // Validate it's the correct player's turn
      const currentPlayerCharacter = players.value[currentPlayer.value % players.value.length];
      if (data.character && data.character !== currentPlayerCharacter) {
        console.log('Ignoring press request - not player\'s turn:', data.character, 'vs', currentPlayerCharacter);
        return;
      }
      
      // Process the switch press
      const result = localPressSwitch(data.index);
      console.log('Press result:', result, 'New state:', {
        currentPlayer: currentPlayer.value,
        switchStates: switchStates.value
      });
      // Immediate sync after press
      setTimeout(() => syncGameState(), 50);
    }
  });
});

// Removed auto-sync to prevent feedback loops
// Host will manually sync after specific actions