import { effect } from '@preact/signals-core';
import { 
  message, 
  currentPlayerName, 
  gameStarted, 
  gameOver, 
  players 
} from '../gameState.js';
import {
  resetGameMultiplayer,
  pressSwitchMultiplayer,
  isConnected,
  characterAssignments,
  localPlayerId,
  playerCharacter,
  roomStarted
} from '../multiplayerState.js';
import { Mario } from './Mario.js';
import { Luigi } from './Luigi.js';
import { Yoshi } from './Yoshi.js';
import { Birdo } from './Birdo.js';

export class GameController extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.cleanup = null;
  }
  
  connectedCallback() {
    this.render();
    this.setupEventListeners();
    
    // Subscribe to state changes
    this.cleanup = effect(() => {
      // Explicitly reference signals we need to track
      const gameStartedValue = gameStarted.value;
      const gameOverValue = gameOver.value;
      const messageValue = message.value;
      const currentPlayerNameValue = currentPlayerName.value;
      const isConnectedValue = isConnected.value;
      const roomStartedValue = roomStarted.value;
      const playerCharacterValue = playerCharacter.value;
      
      this.updateDisplay();
    });
    
    // Setup keyboard controls
    this.setupKeyboardControls();
  }
  
  disconnectedCallback() {
    if (this.cleanup) {
      this.cleanup();
    }
    document.removeEventListener('keydown', this.keyHandler);
  }
  
  setupKeyboardControls() {
    this.keyHandler = (e) => {
      const key = e.key;
      if (key >= '1' && key <= '5') {
        const index = parseInt(key) - 1;
        pressSwitchMultiplayer(index);
      }
    };
    document.addEventListener('keydown', this.keyHandler);
  }
  
  setupEventListeners() {
    const startBtn = this.shadowRoot.querySelector('.start-button');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        resetGameMultiplayer();
      });
    }
  }
  
  updateDisplay() {
    // Show/hide game based on connection and room status
    const gameContainer = this.shadowRoot.querySelector('.game-container');
    const waitingRoom = this.shadowRoot.querySelector('.waiting-room');
    
    if (gameContainer && waitingRoom) {
      const showGame = !isConnected.value || roomStarted.value;
      console.log('GameController updateDisplay:', { 
        isConnected: isConnected.value, 
        roomStarted: roomStarted.value, 
        showGame 
      });
      gameContainer.style.display = showGame ? 'block' : 'none';
      waitingRoom.style.display = showGame ? 'none' : 'block';
    }
    
    const messageEl = this.shadowRoot.querySelector('.message');
    const currentPlayerEl = this.shadowRoot.querySelector('.current-player');
    const startBtn = this.shadowRoot.querySelector('.start-button');
    
    if (messageEl) {
      messageEl.textContent = message.value;
    }
    
    if (currentPlayerEl) {
      if (gameStarted.value && !gameOver.value) {
        if (isConnected.value && playerCharacter.value) {
          const isTurn = currentPlayerName.value === playerCharacter.value;
          currentPlayerEl.innerHTML = `
            <div>Current Turn: <strong style="color: ${getCharacterColor(currentPlayerName.value)}">${currentPlayerName.value}</strong></div>
            <div style="font-size: 0.9em; margin-top: 5px;">You are: <strong style="color: ${getCharacterColor(playerCharacter.value)}">${playerCharacter.value}</strong> ${isTurn ? '(Your Turn!)' : ''}</div>
          `;
        } else {
          currentPlayerEl.textContent = `Current Player: ${currentPlayerName.value}`;
        }
      } else {
        currentPlayerEl.textContent = '';
      }
    }
    
    function getCharacterColor(character) {
      const colors = { 'Mario': 'red', 'Luigi': 'green', 'Yoshi': 'blue', 'Birdo': 'pink' };
      return colors[character] || 'gray';
    }
    
    if (startBtn) {
      startBtn.textContent = gameStarted.value ? 'Restart Game' : 'Start Game';
    }
    
    // Update player indicators
    players.value.forEach((player, index) => {
      const indicator = this.shadowRoot.querySelector(`.player-${index}`);
      if (indicator) {
        const isActive = index === (currentPlayerName.value ? players.value.indexOf(currentPlayerName.value) : -1);
        indicator.classList.toggle('active', isActive && gameStarted.value && !gameOver.value);
      }
    });
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 20px;
          font-family: Arial, sans-serif;
        }
        
        .game-container {
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
          padding: 10px;
        }
        
        .title {
          font-size: 2em;
          margin-bottom: 20px;
          color: #333;
        }
        
        .message {
          font-size: 1.3em;
          margin: 20px 0;
          padding: 15px;
          background: #f0f0f0;
          border-radius: 8px;
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .current-player {
          font-size: 1.1em;
          color: #666;
          margin: 10px 0;
        }
        
        .switches-container {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin: 20px 0;
          flex-wrap: wrap;
        }
        
        .players-container {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin: 20px 0;
          flex-wrap: wrap;
        }
        
        .player-indicator {
          opacity: 0.5;
          transition: opacity 0.3s, transform 0.3s;
        }
        
        .player-indicator.active {
          opacity: 1;
          transform: scale(1.1);
        }
        
        .start-button {
          padding: 12px 24px;
          font-size: 1.1em;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.3s;
        }
        
        .start-button:hover {
          background: #45a049;
        }
        
        .instructions {
          margin-top: 20px;
          padding: 15px;
          background: #e8f4f8;
          border-radius: 8px;
          font-size: 0.9em;
          color: #555;
        }
        
        .multiplayer-status {
          display: inline-block;
          padding: 5px 10px;
          background: #2196F3;
          color: white;
          border-radius: 15px;
          font-size: 0.8em;
          margin-left: 10px;
        }
        
        @media (max-width: 768px) {
          .title {
            font-size: 1.5em;
          }
          
          .message {
            font-size: 1.1em;
            padding: 10px;
          }
          
          .players-container {
            gap: 10px;
          }
          
          .switches-container {
            gap: 10px;
          }
          
          .instructions {
            font-size: 0.85em;
            padding: 10px;
          }
        }
        
        @media (max-width: 480px) {
          :host {
            padding: 10px;
          }
          
          .title {
            font-size: 1.3em;
          }
          
          .message {
            font-size: 1em;
            min-height: 40px;
          }
        }
        
        .waiting-room {
          text-align: center;
          padding: 40px 20px;
          background: #f5f5f5;
          border-radius: 12px;
          margin: 20px auto;
          max-width: 600px;
        }
        
        .waiting-room h2 {
          color: #666;
          margin-bottom: 15px;
        }
        
        .waiting-room p {
          color: #999;
          font-size: 1.1em;
        }
      </style>
      <div class="game-container">
        <h1 class="title">Switch Bomb Game ${isConnected.value ? '<span class="multiplayer-status">ONLINE</span>' : ''}</h1>
        
        <div class="players-container">
          <character-mario class="player-indicator player-0"></character-mario>
          <character-luigi class="player-indicator player-1"></character-luigi>
          <character-yoshi class="player-indicator player-2"></character-yoshi>
          <character-birdo class="player-indicator player-3"></character-birdo>
        </div>
        
        <div class="message"></div>
        <div class="current-player"></div>
        
        <div class="switches-container">
          <game-switch index="0"></game-switch>
          <game-switch index="1"></game-switch>
          <game-switch index="2"></game-switch>
          <game-switch index="3"></game-switch>
          <game-switch index="4"></game-switch>
        </div>
        
        <button class="start-button">Start Game</button>
        
        <div class="instructions">
          <strong>How to play:</strong><br>
          • Press Start to begin the game<br>
          • Players take turns clicking switches or pressing keys 1-5<br>
          • One switch is a bomb - don't press it!<br>
          • If you hit the bomb, you lose!<br>
          • Last player to press a safe switch wins!
        </div>
      </div>
      
      <div class="waiting-room">
        <h2>⏳ Waiting for host to start the game...</h2>
        <p>The host needs to press "Start Game" once enough players have joined.</p>
        <p style="margin-top: 20px; font-size: 0.9em;">Check the Multiplayer Lobby above to see who's in the room.</p>
      </div>
    `;
  }
}

customElements.define('game-controller', GameController);