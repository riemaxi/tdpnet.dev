const config = require('./config')

new class extends require('./system'){
    constructor(){
        super(config.main)
    }

    onDenied(data){
        console.log('denied', data)
    }

    onGranted(data){
        console.log('granted', data)
        this.testSolve()
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
            case 'tsp-solution': console.log(packet.transformer.data) ; break;
        }
    }

    onRequest(id, packet){
        console.log('request', id, Date.now())
        switch(id){
        }
    }

      testSolve(){
        const data = {}
        const token = crypto.randomUUID()
        this.request(this.address, this.peers.tsp,'solve', {token, data})
    }
}