import { Component } from "./base.js";

export class Lobby extends Component{
    constructor(){
        super()
    }

    render(){
        this.shadowRoot.innerHTML = `
        <div></div>
        `
    }
}

customElements.define('main-lobby', Lobby)