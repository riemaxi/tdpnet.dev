
module.exports = class{
    constructor(){
        this._messages = []
        this._peers = []
    }

    addMessage(m){
        this.messages.push(m)
    }

    get messages(){
        return this._messages
    }

    addPeer(p){
        this._peers.push(p)
    }

    removePeer(id){
        this._peers = this._peers.filter(item => item.id != id)
    }

    get _peers(){
        return this._peers
    }
}