import { effect } from '@preact/signals-core';
import { 
  roomCode, 
  isHost, 
  isConnected, 
  playerName,
  roomPlayers,
  playerCharacter,
  characterAssignments,
  localPlayerId,
  createRoom,
  joinRoom
} from '../multiplayerState.js';

export class MultiplayerLobby extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.cleanup = null;
  }
  
  connectedCallback() {
    this.render();
    this.setupEventListeners();
    
    // Set initial player name if exists
    const nameInput = this.shadowRoot.querySelector('#player-name');
    if (nameInput && playerName.value) {
      nameInput.value = playerName.value;
    }
    
    // Subscribe to state changes
    this.cleanup = effect(() => {
      this.updateDisplay();
    });
  }
  
  disconnectedCallback() {
    if (this.cleanup) {
      this.cleanup();
    }
  }
  
  setupEventListeners() {
    // Name input
    const nameInput = this.shadowRoot.querySelector('#player-name');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        playerName.value = e.target.value;
      });
    }
    
    // Create room button
    const createBtn = this.shadowRoot.querySelector('#create-room');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const nameInputValue = nameInput ? nameInput.value.trim() : '';
        if (!nameInputValue) {
          alert('Please enter your name first!');
          nameInput?.focus();
          return;
        }
        playerName.value = nameInputValue;
        const code = createRoom();
        this.showRoomCode(code);
      });
    }
    
    // Join room button
    const joinBtn = this.shadowRoot.querySelector('#join-room');
    const codeInput = this.shadowRoot.querySelector('#room-code');
    if (joinBtn && codeInput) {
      joinBtn.addEventListener('click', () => {
        const nameInputValue = nameInput ? nameInput.value.trim() : '';
        if (!nameInputValue) {
          alert('Please enter your name first!');
          nameInput?.focus();
          return;
        }
        if (!codeInput.value.trim()) {
          alert('Please enter a room code!');
          codeInput.focus();
          return;
        }
        playerName.value = nameInputValue;
        joinRoom(codeInput.value);
      });
      
      // Allow joining with Enter key
      codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          joinBtn.click();
        }
      });
    }
    
    // Copy room code button
    const copyBtn = this.shadowRoot.querySelector('#copy-code');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(roomCode.value).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = 'Copy Code';
          }, 2000);
        });
      });
    }
    
    // Share button (mobile)
    const shareBtn = this.shadowRoot.querySelector('#share-code');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Switch Bomb Game',
              text: `Join my game! Room code: ${roomCode.value}`,
              url: window.location.href
            });
          } catch (err) {
            console.log('Share cancelled');
          }
        }
      });
    }
  }
  
  showRoomCode(code) {
    const display = this.shadowRoot.querySelector('.room-display');
    if (display) {
      display.style.display = 'block';
    }
  }
  
  updateDisplay() {
    // Update connection status
    const statusEl = this.shadowRoot.querySelector('.connection-status');
    if (statusEl) {
      statusEl.textContent = isConnected.value ? 'Connected' : 'Not Connected';
      statusEl.className = 'connection-status ' + (isConnected.value ? 'connected' : '');
    }
    
    // Update room display
    const roomDisplay = this.shadowRoot.querySelector('.room-display');
    const lobbySection = this.shadowRoot.querySelector('.lobby-section');
    if (roomDisplay && lobbySection) {
      if (isConnected.value) {
        roomDisplay.style.display = 'block';
        lobbySection.style.display = 'none';
      } else {
        roomDisplay.style.display = 'none';
        lobbySection.style.display = 'block';
      }
    }
    
    // Update room code display
    const codeDisplay = this.shadowRoot.querySelector('.code-display');
    if (codeDisplay) {
      codeDisplay.textContent = roomCode.value;
    }
    
    // Update host badge
    const hostBadge = this.shadowRoot.querySelector('.host-badge');
    if (hostBadge) {
      hostBadge.style.display = isHost.value ? 'inline-block' : 'none';
    }
    
    // Update player list with character assignments
    const playerList = this.shadowRoot.querySelector('.player-list');
    if (playerList) {
      const assignments = characterAssignments.value;
      let html = '<div style="font-weight: bold; margin-bottom: 10px;">Players in Room (Max 4):</div>';
      
      // Show active players
      const activePlayers = roomPlayers.value
        .filter(p => p.active)
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .slice(0, 4);
        
      activePlayers.forEach(p => {
        const assignment = assignments[p.id];
        const isMe = p.id === localPlayerId.value;
        const color = assignment?.color || 'gray';
        html += `
          <div class="player-item ${isMe ? 'is-me' : ''}" style="border-left: 4px solid ${color};">
            <div class="player-info">
              <span class="player-character" style="color: ${color};">${assignment?.character || 'Waiting...'}</span>
              <span class="player-name">${p.name} ${isMe ? '(You)' : ''}</span>
            </div>
            ${isHost.value && isMe ? '<span class="host-tag">HOST</span>' : ''}
          </div>
        `;
      });
      
      // Show empty slots
      const currentCount = activePlayers.length;
      const characters = ['Mario', 'Luigi', 'Yoshi', 'Birdo'];
      const colors = { 'Mario': 'red', 'Luigi': 'green', 'Yoshi': 'blue', 'Birdo': 'pink' };
      
      for (let i = currentCount; i < 4; i++) {
        const character = characters[i];
        const color = colors[character];
        html += `
          <div class="player-item empty-slot" style="border-left: 4px solid ${color}; opacity: 0.5;">
            <div class="player-info">
              <span class="player-character" style="color: ${color};">${character}</span>
              <span class="player-name">Waiting for player...</span>
            </div>
          </div>
        `;
      }
      
      playerList.innerHTML = html;
    }
    
    // Show/hide share button based on capability
    const shareBtn = this.shadowRoot.querySelector('#share-code');
    if (shareBtn) {
      shareBtn.style.display = navigator.share ? 'inline-block' : 'none';
    }
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .title {
          font-size: 1.5em;
          margin-bottom: 20px;
          color: #333;
          text-align: center;
        }
        
        .connection-status {
          text-align: center;
          padding: 5px 10px;
          border-radius: 20px;
          background: #f0f0f0;
          color: #666;
          font-size: 0.9em;
          margin-bottom: 20px;
          display: inline-block;
        }
        
        .connection-status.connected {
          background: #4CAF50;
          color: white;
        }
        
        .lobby-section {
          display: block;
        }
        
        .input-group {
          margin-bottom: 15px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          color: #555;
          font-size: 0.9em;
        }
        
        input {
          width: 100%;
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1em;
          box-sizing: border-box;
          transition: border-color 0.3s;
        }
        
        input:focus {
          outline: none;
          border-color: #4CAF50;
        }
        
        .button-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        
        button {
          flex: 1;
          padding: 12px 20px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1em;
          cursor: pointer;
          transition: background 0.3s;
          font-weight: 500;
        }
        
        button:hover {
          background: #45a049;
        }
        
        button:active {
          transform: scale(0.98);
        }
        
        #join-room {
          background: #2196F3;
        }
        
        #join-room:hover {
          background: #1976D2;
        }
        
        .room-display {
          display: none;
          text-align: center;
        }
        
        .code-display {
          font-size: 2.5em;
          font-weight: bold;
          letter-spacing: 0.1em;
          color: #4CAF50;
          margin: 20px 0;
          padding: 15px;
          background: #f0f0f0;
          border-radius: 12px;
          font-family: monospace;
        }
        
        .host-badge {
          display: none;
          background: #FF9800;
          color: white;
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 0.9em;
          margin: 10px auto;
          width: fit-content;
        }
        
        .player-list {
          margin-top: 20px;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 8px;
        }
        
        .player-item {
          padding: 12px;
          margin: 8px 0;
          background: white;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.3s ease;
        }
        
        .player-item.is-me {
          background: #e8f5e9;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .player-item.empty-slot {
          background: #fafafa;
          border-style: dashed !important;
        }
        
        .player-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .player-character {
          font-weight: bold;
          font-size: 1.1em;
        }
        
        .player-name {
          font-size: 0.85em;
          color: #666;
        }
        
        .host-tag {
          background: #FF9800;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.8em;
        }
        
        .divider {
          text-align: center;
          margin: 20px 0;
          color: #999;
          position: relative;
        }
        
        .divider::before,
        .divider::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 40%;
          height: 1px;
          background: #e0e0e0;
        }
        
        .divider::before {
          left: 0;
        }
        
        .divider::after {
          right: 0;
        }
        
        #share-code {
          background: #9C27B0;
        }
        
        #share-code:hover {
          background: #7B1FA2;
        }
        
        @media (max-width: 600px) {
          :host {
            padding: 15px;
            margin: 10px;
          }
          
          .code-display {
            font-size: 2em;
          }
          
          .button-group {
            flex-direction: column;
          }
          
          button {
            width: 100%;
          }
        }
      </style>
      
      <div class="title">🎮 Multiplayer Lobby</div>
      <div class="connection-status">Not Connected</div>
      
      <div class="lobby-section">
        <div class="input-group">
          <label for="player-name">Your Name:</label>
          <input type="text" id="player-name" placeholder="Enter your name" maxlength="20">
        </div>
        
        <div class="button-group">
          <button id="create-room">Create Room</button>
        </div>
        
        <div class="divider">OR</div>
        
        <div class="input-group">
          <label for="room-code">Room Code:</label>
          <input type="text" id="room-code" placeholder="Enter room code" maxlength="6" style="text-transform: uppercase;">
        </div>
        
        <div class="button-group">
          <button id="join-room">Join Room</button>
        </div>
      </div>
      
      <div class="room-display">
        <div class="host-badge">You are the HOST</div>
        <div>Room Code:</div>
        <div class="code-display"></div>
        <div class="button-group">
          <button id="copy-code">Copy Code</button>
          <button id="share-code">Share</button>
        </div>
        
        <div class="player-list">
          <div style="font-weight: bold; margin-bottom: 10px;">Players in Room:</div>
        </div>
      </div>
    `;
  }
}

customElements.define('multiplayer-lobby', MultiplayerLobby);