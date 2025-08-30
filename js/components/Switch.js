import { effect } from '@preact/signals-core';
import { switchStates, gameOver, gameStarted } from '../gameState.js';
import { pressSwitchMultiplayer } from '../multiplayerState.js';

export class Switch extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.index = 0;
    this.cleanup = null;
  }
  
  connectedCallback() {
    this.index = parseInt(this.getAttribute('index') || '0');
    this.render();
    
    // Subscribe to state changes
    this.cleanup = effect(() => {
      const isPressed = switchStates.value[this.index];
      const isDisabled = gameOver.value || !gameStarted.value;
      this.updateState(isPressed, isDisabled);
    });
    
    // Add click handler
    this.shadowRoot.querySelector('.switch').addEventListener('click', () => {
      this.handleClick();
    });
  }
  
  disconnectedCallback() {
    if (this.cleanup) {
      this.cleanup();
    }
  }
  
  handleClick() {
    pressSwitchMultiplayer(this.index);
  }
  
  updateState(isPressed, isDisabled) {
    const switchEl = this.shadowRoot.querySelector('.switch');
    if (switchEl) {
      switchEl.classList.toggle('pressed', isPressed);
      switchEl.classList.toggle('disabled', isDisabled);
    }
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
        }
        
        .switch {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 2px solid black;
          background-color: white;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }
        
        .switch:hover:not(.disabled):not(.pressed) {
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .switch:active:not(.disabled):not(.pressed) {
          transform: scale(0.95);
        }
        
        .switch.pressed {
          background-color: #ff4444;
          color: white;
          cursor: not-allowed;
          opacity: 0.7;
        }
        
        .switch.pressed::after {
          content: '✕';
        }
        
        .switch.disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        
        .key-hint {
          position: absolute;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          color: #666;
          font-family: monospace;
        }
        
        .container {
          position: relative;
          display: inline-block;
        }
        
        @media (max-width: 768px) {
          .switch {
            width: 70px;
            height: 70px;
            font-size: 20px;
          }
        }
        
        @media (max-width: 480px) {
          .switch {
            width: 60px;
            height: 60px;
            font-size: 18px;
          }
          
          .key-hint {
            font-size: 10px;
            top: -15px;
          }
        }
      </style>
      <div class="container">
        <div class="key-hint">[${this.index + 1}]</div>
        <div class="switch">${this.index + 1}</div>
      </div>
    `;
  }
}

customElements.define('game-switch', Switch);