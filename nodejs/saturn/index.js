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
        const formula = [[1, -2], [3]]
        this.request(this.address, this.peers.saturn,'solve', formula)
    }

    onEvent(id, packet){
        const to = packet.pearing.from;
        console.log('event', id, to, Date.now())
        switch(id){
        }
    }

    onResponse(id, packet){
        console.log('response', id, Date.now())
        switch(id){
            case 'saturn-solution': console.log(packet.transformer.data) ; break;
        }
    }

    onRequest(id, packet){
        console.log('request', id, Date.now())
        switch(id){
        }

    }
}