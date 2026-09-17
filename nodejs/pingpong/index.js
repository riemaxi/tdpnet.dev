const config = require('./config')

new class extends require('./system'){
    constructor(){
        super(config.ponpin)
    }

    onDenied(data){
        console.log('denied', data)
    }

    onGranted(data){
        console.log('granted', data)
        this.request(this.address, this.peers.pinpon, 'ping', 0)
        //this.notify(this.address, 'pinpon.aladino.maya.4da', 'pong', 0)
    }

    onEvent(id, packet){
        const to = packet.pearing.from;
        console.log('event', id, to, Date.now())
        switch(id){
            case 'ping': setTimeout(() => this.notify(this.address,to, 'pong', 0), 2000); break;
        }
    }

    onResponse(id, packet){
        console.log('response', id, Date.now())
        switch(id){
            case 'pong': setTimeout(() => this.response(packet, 'ping', 1), 2000); break;
        }
    }

    onRequest(id, packet){
        console.log('request', id, Date.now())
        switch(id){
            case 'pong': setTimeout(() => this.response(packet, 'ping', 1), 1000); break;
        }

    }
}