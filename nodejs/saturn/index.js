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
        this.testSolveX()
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
            case 'saturn-solution-x': console.log(packet.transformer.data) ; break;

        }
    }

    onRequest(id, packet){
        console.log('request', id, Date.now())
        switch(id){
        }
    }

    testSolve(){
        const formula = [[1, -2], [3]]
        const toke = crypto.randomUUID()
        this.request(this.address, this.peers.saturn,'solve', formula)
    }

    testSolveX(){
        const formula = [[1, -2], [3]]
        const token = crypto.randomUUID()
        this.request(this.address, this.peers.saturn,'solve-x', {token, formula})
    }
}