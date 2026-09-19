import { Component } from './base.js';

export class MessageList extends Component {
  initialize() {
    this.messages = [];
  }

  update(payload) {
    if (payload?.messages) {
      this.messages = payload.messages;
      this.render();
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div part="container">
        ${this.messages.length === 0 
          ? `<div part="empty-state">No messages yet...</div>` 
          : this.messages.map(m => `
              <div part="msg ${m.isSelf ? 'msg-self' : 'msg-peer'}">
                <div part="msg-author">${m.sender}</div>
                <div part="msg-text">${m.text}</div>
              </div>
            `).join('')}
      </div>
    `;
    this.listen();
  }

  listen() {
    const container = this.shadowRoot.querySelector('[part~="container"]');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}

customElements.define('message-list', MessageList);