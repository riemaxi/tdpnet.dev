import { Component } from './base.js';

export class PeerList extends Component {
  initialize() {
    this.peers = [
      { id: '1', name: 'Peer 1', selected: true },
      { id: '2', name: 'Peer 2', selected: true },
      { id: '3', name: 'Peer 3', selected: true }
    ];
  }

  update(payload) {
    if (payload?.peers) {
      this.peers = payload.peers;
      this.render();
    }
  }

  get selectedPeerIds() {
    return this.peers.filter(p => p.selected).map(p => p.id);
  }

  render() {
    const allSelected = this.peers.length > 0 && this.peers.every(p => p.selected);

    this.shadowRoot.innerHTML = `
      <div part="container">
        <div part="title">Peers</div>
        <label part="select-all-item">
          <input type="checkbox" id="select-all" part="checkbox select-all-checkbox" ${allSelected ? 'checked' : ''} />
          <span part="select-all-label">Select All</span>
        </label>
        <div part="list">
          ${this.peers.map(peer => `
            <label part="peer-item">
              <input type="checkbox" class="peer-checkbox" part="checkbox peer-checkbox" data-id="${peer.id}" ${peer.selected ? 'checked' : ''} />
              <span part="peer-label">${peer.name}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
    this.listen();
  }

  listen() {
    const selectAllCb = this.get('select-all');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        const checked = e.target.checked;
        this.peers.forEach(p => p.selected = checked);
        this.render();
        this.notifyChange();
      });
    }

    const checkboxes = this.listall('.peer-checkbox');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const peer = this.peers.find(p => p.id === id);
        if (peer) peer.selected = e.target.checked;
        
        const allCb = this.get('select-all');
        if (allCb) {
          allCb.checked = this.peers.every(p => p.selected);
        }
        this.notifyChange();
      });
    });
  }

  notifyChange() {
    this.on({
      target: 'b',
      action: 'targets-updated',
      payload: { selectedTargets: this.selectedPeerIds }
    });
  }
}

customElements.define('peer-list', PeerList);