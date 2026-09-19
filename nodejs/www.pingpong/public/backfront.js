class Backend{
  /*Backend mockup code here
  request: handle request
  on: emit result from request
  */
  request(msg){}
  on(msg){}
}

class Proxy {
  constructor() {
    this.initialize();
  }

  initialize() {
     this.dashboard = document.getElementById('dashboard');
    this.dashboard.on = msg => this.onrequest(msg);
  }

  onmessage(msg) {  this.update(JSON.parse(msg.data)); }
  onrequest(msg) {  this.send(msg);  }

  update(msg) { this.dashboard.update(msg); }  
  send(msg) { }
} 

class RemoteProxy extends Proxy {
  constructor() {
    super();
  }

  get host() { return '' }

  initialize() {
    super.initialize();

    this.socket = new WebSocket(this.host);
    this.socket.onmessage = msg => this.onmessage(msg);
  }

  send(msg) { this.socket.send(JSON.stringify(msg)) }
}

class SecureProxy extends RemoteProxy{
  initialize(){
    super.initialize()
    this.lobby = document.getElementById('lobby')

    this.lobby.on = msg => this.onrequest(msg)
  }

  update(msg){
    const {id, data} = msg
    if (id == 'access'){
      if (data.granted){
        document.state.context = data
        this.lobby.hide()
        this.dashboard.show(data.message)
      }else{ 
          this.lobby.show()
          this.dashboard.hide()

          this.lobby.message = data.message
      }

    }

    super.update(msg)
  }
}

class LocalProxy extends Proxy {
  constructor() {
    super();
  }

  initialize(){
    super.initialize()

    this.backend = new Backend()    

    this.backend.on = msg => this.update(msg)

    this.backend.on({id: 'init', data: {}})
  }

  send(msg) { this.backend.request(msg); }
}   


export {  LocalProxy as Proxy };