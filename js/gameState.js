import { signal, computed, effect } from '@preact/signals-core';

// Game state signals
export const currentPlayer = signal(0);
export const gameOver = signal(false);
export const winner = signal(null);
export const loser = signal(null);
export const bombIndex = signal(Math.floor(Math.random() * 5));
export const switchStates = signal([false, false, false, false, false]);
export const players = signal(['Mario', 'Luigi', 'Yoshi', 'Birdo']);
export const gameStarted = signal(false);
export const message = signal('Press Start to begin!');
export const bombHit = signal(false);

// Computed values
export const currentPlayerName = computed(() => {
  return players.value[currentPlayer.value % players.value.length];
});

export const pressedSwitchCount = computed(() => {
  return switchStates.value.filter(state => state).length;
});

// Audio management
function playBoomSound() {
  const audio = new Audio('./img/boom.mp3');
  audio.volume = 0.7;
  
  // Clone and play the audio
  const audioClone = audio.cloneNode();
  audioClone.play().catch(err => console.warn('Failed to play boom sound:', err));
  
  // Clean up after playback
  audioClone.addEventListener('ended', () => {
    audioClone.remove();
  });
  
  // Also clean up on error
  audioClone.addEventListener('error', () => {
    audioClone.remove();
  });
}

// Play boom sound when bomb is hit
effect(() => {
  if (bombHit.value) {
    playBoomSound();
    // Reset bombHit after playing
    setTimeout(() => {
      bombHit.value = false;
    }, 100);
  }
});

// Game functions
export function resetGame() {
  currentPlayer.value = 0;
  gameOver.value = false;
  winner.value = null;
  loser.value = null;
  bombIndex.value = Math.floor(Math.random() * 5);
  switchStates.value = [false, false, false, false, false];
  gameStarted.value = true;
  bombHit.value = false;
  message.value = `${currentPlayerName.value}'s turn - Pick a switch (1-5)`;
}

export function pressSwitch(index) {
  if (gameOver.value || !gameStarted.value) return false;
  if (switchStates.value[index]) return false; // Already pressed
  
  // Update switch state
  const newStates = [...switchStates.value];
  newStates[index] = true;
  switchStates.value = newStates;
  
  // Check if it's the bomb
  if (index === bombIndex.value) {
    gameOver.value = true;
    loser.value = currentPlayerName.value;
    message.value = `💥 BOOM! ${currentPlayerName.value} hit the bomb and lost!`;
    bombHit.value = true; // Trigger bomb sound for all players
    return true;
  }
  
  // Check if all non-bomb switches are pressed (winner condition)
  const remainingSwitches = switchStates.value.filter((state, i) => !state && i !== bombIndex.value).length;
  if (remainingSwitches === 0) {
    gameOver.value = true;
    winner.value = currentPlayerName.value;
    message.value = `🎉 ${currentPlayerName.value} wins! All safe switches pressed!`;
    return false;
  }
  
  // Move to next player
  currentPlayer.value = (currentPlayer.value + 1) % players.value.length;
  message.value = `Safe! ${currentPlayerName.value}'s turn - Pick a switch (1-5)`;
  return false;
}

// Effect to log state changes
effect(() => {
  console.log('Game State:', {
    currentPlayer: currentPlayerName.value,
    gameOver: gameOver.value,
    bombIndex: bombIndex.value,
    switchStates: switchStates.value,
    message: message.value
  });
});