import { Component } from './base.js';

export class MessageEditor extends Component {
  render() {
    this.shadowRoot.innerHTML = `
      <div part="container">
        <textarea id="input" part="input" placeholder="Message..."></textarea>
        <button id="send" part="send-btn" aria-label="Send"></button>
      </div>
    `;
    this.listen();
  }

  listen() {
    const btn = this.get('send');
    const input = this.get('input');

    const submitMsg = () => {
      const text = input.value.trim();
      if (text) {
        this.on({
          target: 'b',
          action: 'send-message',
          payload: { text }
        });
        input.value = '';
      }
    };

    if (btn) btn.addEventListener('click', submitMsg);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submitMsg();
        }
      });
    }
  }
}

customElements.define('message-editor', MessageEditor);