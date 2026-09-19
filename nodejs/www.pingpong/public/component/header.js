import { Component } from './base.js';

export class ChatHeader extends Component {
  initialize() {
    this.user = { name: 'User' };
  }

  update(payload) {
    if (payload?.user) {
      this.user = payload.user;
      this.render();
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div part="container">
        <div part="branding">
          <div part="logo"></div>
          <span part="username">${this.user.name}</span>
        </div>
        <button id="signoff" part="signoff-btn">Sign Out</button>
      </div>
    `;
    this.listen();
  }

  listen() {
    const btn = this.get('signoff');
    if (btn) {
      btn.addEventListener('click', () => {
        this.on({ target: 'b', action: 'signoff', payload: {} });
      });
    }
  }
}

customElements.define('chat-header', ChatHeader);