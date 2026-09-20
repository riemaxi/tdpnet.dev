import { Component } from './base.js';

export class Dashboard extends Component {
  get chatHeader() { return this.get('header'); }
  get peerList() { return this.get('peer-list'); }
  get messageList() { return this.get('message-list'); }
  get messageEditor() { return this.get('message-editor'); }

  render() {
    this.shadowRoot.innerHTML = `
      <div part="dashboard-wrapper">
        <chat-header 
          id="header" 
          part="header"
          exportparts="
            container: header-container,
            branding: header-branding,
            logo: header-logo,
            username: header-username,
            signoff-btn: header-signoff-btn
          "
        ></chat-header>
        
        <peer-list 
          id="peer-list" 
          part="peer-list"
          exportparts="
            container: peers-container,
            title: peers-title,
            select-all-item: peers-select-all-item,
            peer-item: peers-peer-item,
            checkbox: peers-checkbox,
            list: peers-list
          "
        ></peer-list>
        
        <message-list 
          id="message-list" 
          part="message-list"
          exportparts="
            container: messages-container,
            empty-state: messages-empty-state,
            msg: messages-msg,
            msg-self: messages-msg-self,
            msg-author: messages-msg-author
          "
        ></message-list>
        
        <message-editor 
          id="message-editor" 
          part="message-editor"
          exportparts="
            container: editor-container,
            input: editor-input,
            send-btn: editor-send-btn
          "
        ></message-editor>
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