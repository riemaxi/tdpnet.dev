const WebSocket = require('ws');
const {Packeter} = require('./helper')
const {Packet, Peering} = require('./packet')

class TDPnet {
  constructor() {
    this._socket = null;
  }

  async connect(host, ca) {
    return new Promise((resolve, reject) => {
      try {
        this._socket = new WebSocket(host, { ca, rejectUnauthorized: false } );

        this._socket.on('open', () => {
          this.onConnected(Date.now());
          resolve();
        });

        this._socket.on('message', (event) => {
          try {
            const m = JSON.parse(event);
            this.handleEvent(m.id, m.data);
          } catch (err) {
            this.onError(err);
          }
        });

        this._socket.on('error', (err) => {
          this.onError(err);
          this.onConnectionError(err);
          reject(err);
        });

        this._socket.on('close', () => {
          this.onConnectionError('Connection closed');
        });
      } catch (e) {
        this.onConnectionError(e);
        reject(e);
      }
    });
  }

  onConnected(timestamp) {
    // override
  }

  onError(err) {
    // override
  }

  onConnectionError(err) {
    // override
  }

  handleEvent(id, data) {
    // abstract - override in subclass
  }

  send(id, data) {
    if (this._socket && this._socket.readyState === WebSocket.OPEN) {
      this._socket.send(JSON.stringify({ id, data }));
    } else {
      this.onError('Socket is not open.');
    }
  }
}

class Session extends TDPnet {
  signin(data) {
    this.send('signin', data);
  }

  signoff(data) {
    this.send('signoff', data);
  }

  sendData(data) {
    this.send('data', data);
  }

  sendSignal(data) {
    this.send('signal', data);
  }

  handleEvent(id, data) {
    switch (id) {
      case 'error':
        this.onError(data);
        break;
      case 'open' :
        this.onOpen(data)
        break;
      case 'signal':
        this.onSignal(data);
        break;
      case 'data':
        this.onData(data);
        break;
      case 'granted':
        this.onGranted(data);
        break;
      case 'denied':
        this.onDenied(data);
        break;
      default:
        break;
    }
  }

  onOpen(data){}

  onGranted(data) {
    // override
  }

  onDenied(data) {
    // override
  }

  onSignal(data) {
    // override
  }

  onData(data) {
    // override
  }
}

class StandardSession extends Session{
  constructor(){
    super()
  }

    onSignal(e){
      let packet = Packet.fromString(e)
      let [category, id] = packet.peering.subject.split(':')
      switch(category){
          case 'request' : this.onRequest(id, packet); break;
          case 'response' : this.onResponse(id, packet); break;
          case 'event' : this.onEvent(id, packet); break;
      }
  }

  onData(e){
      let packet = Packet.fromString(e)
      let [category, id] = packet.peering.subject.split(':')
      switch(category){
          case 'request' : this.onRequest(id, packet); break;
          case 'response' : this.onResponse(id, packet); break;
          case 'event' : this.onEvent(id, packet); break;
      }
  }

  onRequest(id, p){}
  onResponse(id, p){}
  onEvent(id, p){}

  request(from, to, id,  data){
      let packet = Packeter.createSignal(
          {
            from,
            to,
            subject: 'request:' + id,
            data: JSON.stringify(data)
          }            
      )
      this.sendSignal(packet)
  }

  response(packet, id, data){
      packet.peering = new Peering(packet.peering.to, packet.peering.from, 'response:' + id)
      packet.transformer.data = JSON.stringify(data)

      packet.channel.isSignal = 0
      this.sendData(packet.toString())
  }

  notify(from, to, id,  data){
      let packet = Packeter.createSignal(
          {
              from,
              to,
              subject: 'event:' + id,
              data: JSON.stringify(data)
          }            
      )
      this.sendSignal(packet)
  }  
}

module.exports = { 
  TDPnet, 
  Session,
  StandardSession
}
