export class Mario extends HTMLElement {
  static color = 'red';
  
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  
  connectedCallback() {
    this.render();
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          padding: 20px;
          margin: 10px;
          background-color: ${Mario.color};
          color: white;
          border-radius: 8px;
          font-family: Arial, sans-serif;
          text-align: center;
          cursor: pointer;
          transition: transform 0.2s;
        }
        
        :host(:hover) {
          transform: scale(1.05);
        }
        
        .character-name {
          font-size: 1.5em;
          font-weight: bold;
        }
        
        .character-color {
          font-size: 0.9em;
          opacity: 0.9;
          margin-top: 5px;
        }
      </style>
      <div class="character-name">Mario</div>
      <div class="character-color">Color: ${Mario.color}</div>
    `;
  }
}

customElements.define('character-mario', Mario);