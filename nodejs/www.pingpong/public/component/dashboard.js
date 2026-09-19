import { Component } from './base.js';
import './header.js';
import './peers.js';
import './messages.js';
import './editor.js';

export class Dashboard extends Component {
  get chatHeader() { return this.get('header'); }
  get peerList() { return this.get('peer-list'); }
  get messageList() { return this.get('message-list'); }
  get messageEditor() { return this.get('message-editor'); }

  render() {
    this.shadowRoot.innerHTML = `
      <div part="dashboard-wrapper">
        <chat-header id="header" part="header"></chat-header>
        <peer-list id="peer-list" part="peer-list"></peer-list>
        <message-list id="message-list" part="message-list"></message-list>
        <message-editor id="message-editor" part="message-editor"></message-editor>
      </div>
    `;
    this.listen();
  }

  listen() {
    const components = [
      this.chatHeader,
      this.peerList,
      this.messageList,
      this.messageEditor
    ];

    components.forEach(comp => {
      if (comp) {
        comp.on = (data) => {
          const { target, action, payload } = data;
          if (target === 'b') {
            this.on({ action, payload, source: comp.tagName.toLowerCase() });
          }
        };
      }
    });
  }
}

customElements.define('main-dashboard', Dashboard);