const { performance } = require('perf_hooks');
const express = require('express');
const http = require('http');
const https = require('https'); // Added for SSL
const { WebSocketServer } = require('ws');

//Non Secure
class NonSecure{
    constructor(port, home='public'){
        this.home = home;
        this.port = port;

    }

    start(handle){
        const app = express();
        app.use(express.static(this.home));

        const server = http.createServer(app);
        this.wss = new WebSocketServer({ server });

         this.wss.on('connection', (ws) => {
            const context = {}

            this.onConnection(context,   ws);

            ws.on('message', msg => {
                let {action, payload} = JSON.parse(msg);
                this.onAction(action, payload, context, ws)
            })

            ws.on('close', () => this.onClose(ws))
        });


        server.listen(this.port, () => handle());
    }

    onAction(id, data, context, ws){}

    onConnection(context, ws){}
    onClose(ws){}

    
    send(id, data, context, ws){
        ws.send(JSON.stringify({id, data}))
    }

    broadcast(data, context){
        this.wss.clients.forEach(ws => this.send(data, context, ws))
    }
}

//Secure
class Secure {
    constructor(port, home = 'public', ssl) {
        this.home = home;
        this.port = port;
        this.ssl = ssl; // Expecting { key: fs.readFileSync(...), cert: fs.readFileSync(...) }
    }

    start(handle) {
        const app = express();

        // Initialize HTTPS server with SSL credentials
        const server = https.createServer(this.ssl, app);
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws) => {
            const context = {};

            this.onConnection(context, ws);

            ws.on('message', msg => {
                try {
                    let { action, payload } = JSON.parse(msg);
                    this.onAction(action, payload, context, ws);
                } catch (e) {
                    console.error("Failed to parse message:", e);
                }
            });

            ws.on('close', () => this.onClose(ws));
        });

        app.use(express.static(this.home));

        server.listen(this.port, () => handle());
    }

    onAction(id, data, context, ws) {}
    onConnection(context, ws) {}
    onClose(ws) {}

    send(id, data, context, ws) {
        ws.send(JSON.stringify({ id, data }));
    }

    broadcast(data, context){
        this.wss.clients.forEach(ws => this.send(data, context, ws))
    }
}

module.exports = {
    NonSecure,
    Secure
}