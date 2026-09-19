export class Component extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.initialize();
  }

  get(id) {
    return this.shadowRoot.getElementById(id);
  }

  listall(query) {
    return this.shadowRoot.querySelectorAll(query);
  }

  initialize() { }

  update(payload) {
    const { id, data } = payload;
    console.log(id, data);

    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = ``;
    this.listen();
  }

  listen() {
    // Add UI listeners and fire using this.on({id, data})
  }

  on(_) { }

  connectedCallback() {
    this.render(); // Using initialized data
  }
}