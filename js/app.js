// Import character components
import './components/Mario.js';
import './components/Luigi.js';
import './components/Yoshi.js';
import './components/Birdo.js';

// Import game components
import './components/Switch.js';
import './components/GameController.js';
import './components/MultiplayerLobby.js';

// ES Module example
console.log('Switch Bomb Game initialized');

// Example module export
export function init() {
  console.log('Game started');
  
  // Add game initialization logic here
  setupEventListeners();
  renderInitialState();
}

function setupEventListeners() {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - ready to initialize game');
  });
}

function renderInitialState() {
  const gameContainer = document.createElement('div');
  gameContainer.id = 'game-container';
  gameContainer.innerHTML = `
    <multiplayer-lobby></multiplayer-lobby>
    <game-controller></game-controller>
  `;
  
  // Add some basic styles
  const style = document.createElement('style');
  style.textContent = `
    body {
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    
    #game-container {
      padding: 20px;
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    @media (max-width: 768px) {
      body {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        min-height: -webkit-fill-available;
      }
      
      #game-container {
        padding: 10px;
      }
    }
  `;
  
  document.addEventListener('DOMContentLoaded', () => {
    document.head.appendChild(style);
    document.body.innerHTML = '';
    document.body.appendChild(gameContainer);
  });
}

// Auto-initialize on module load
init();