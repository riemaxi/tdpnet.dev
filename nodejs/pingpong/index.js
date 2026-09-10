const config = require('./config')

new class extends require('./system'){
    constructor(){
        super(config.pinpon)
    }

    onDenied(data){
        console.log('denied', data)
    }

    onGranted(data){
        console.log('granted', data)
    }

    onEvent(id, packet){
        const to = packet.pearing.from;
        console.log('event', id, to, Date.now())
        switch(id){
            case 'ping': setTimeout(() => this.notify(this.address,to, 'pong', 0), 2000); break;
        }
    }

    onResponse(id, packet){
        console.log('response', id, packet.peering?.from,  Date.now())
        switch(id){
            case 'ping': setTimeout(() => this.response(packet, 'pong', 0), 2000); break;
        }
    }

    onRequest(id, packet){
        console.log('request', id, packet.peering?.from,  Date.now())
        switch(id){
            case 'ping': setTimeout(() => this.response(packet, 'pong',0), 1000); break;
        }

    }
}

new class extends require('./system'){
    constructor(){
        super(config.ponpin)
    }

    onDenied(data){
        console.log('denied', data)
    }

    onGranted(data){
        console.log('granted', data)
        this.request(this.address, '', 'ping', 0)
    }

    onEvent(id, packet){
        const to = packet.pearing.from;
        console.log('event', id, to, Date.now())
        switch(id){
            case 'ping': setTimeout(() => this.notify(this.address,to, 'pong', 0), 2000); break;
        }
    }

    onResponse(id, packet){
        console.log('response',this.address,  id, packet.peering?.from,  Date.now())
        switch(id){
            case 'pong': setTimeout(() => this.response(packet, 'ping', 1), 1000); break;
        }
    }

    onRequest(id, packet){
        console.log('request', this.address,  id, packet.peering?.from,  Date.now())
        switch(id){
            case 'pong': setTimeout(() => this.response(packet, 'ping', 1), 1000); break;
        }

    }
}



new class extends require('./system'){
    constructor(){
        super(config.punpin)
    }

    onDenied(data){
        console.log('denied', data)
    }

    onGranted(data){
        console.log('granted', data)
        this.request(this.address, '', 'ping', 0)
    }

    onEvent(id, packet){
        const to = packet.pearing.from;
        console.log('event', id, to, Date.now())
        switch(id){
            case 'ping': setTimeout(() => this.notify(this.address,to, 'pong', 0), 2000); break;
        }
    }

    onResponse(id, packet){
        console.log('response', this.address, id, packet.peering?.from,  Date.now())
        switch(id){
            case 'pong': setTimeout(() => this.response(packet, 'ping', 1), 1000); break;
        }
    }

    onRequest(id, packet){
        console.log('request', id, packet.peering?.from,  Date.now())
        switch(id){
            case 'pong': setTimeout(() => this.response(packet, 'ping', 1), 1000); break;
        }

    }
}