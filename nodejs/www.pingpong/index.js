const config = require('./config')

class SP extends require('./network').SP{
    constructor(handle){
        super(config.ponpin)

        this.handle = handle
    }

   onConnected(){
        this.handle('connected', { time: Date.now()})
    }


    onDenied(data){
        console.log('denied', data)
        this.handle('denied', data)
    }

    onGranted(data){
        console.log('granted', data)
        this.handle('granted', data)
    }

    onEvent(id, packet){
         
    }

    onRequest(id, packet){

    }

    onResponse(id, packet){

    }
}


new class extends require('./portal').NonSecure    {
    constructor() {
        super(config.port, config.home);
        this.start(() => console.log('on', config.port))
    }

    onConnection(context, ws) {
        context.sp = new SP((id, data) => this.handleSP(data, context, ws))
        this.send('init', new Welcome().data, context, ws);
    }

    onClose(ws) {
    }

    onAction(id, data, context, ws) {
        console.log("Action received:", id, data);
        switch (id) {
            case 'signin': context.sp.signin(data); break;
            case 'signout': context.sp.signout(data); break;
            default: context.sp.notify(id, data); break;
        }
    }

    handleSP(id, data, context, ws){
        this.send(id, data, context, ws)
    }
}


