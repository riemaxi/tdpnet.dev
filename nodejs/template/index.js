const config = require('./config')

new class extends require('./portal').NonSecure    {
    constructor() {
        super(config.port, config.home);
        this.start(() => console.log('on', config.port))
    }

    onConnection(context, ws) {
        this.send('init', new Welcome().data, context, ws);
    }

    onClose(ws) {
    }

    onAction(id, data, context, ws) {
        console.log("Action received:", id, data);
        switch (id) {
        }
    }
}


