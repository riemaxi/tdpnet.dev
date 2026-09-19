module.exports = class extends require('./core/tdpnet').StandardSession{
    constructor(config, connect = true){
        super()
        this.config = config

        connect && this.connect(this.host, this.ssl)
    }

    get ssl() { return this.config.ssl }
    get host()  { return this.config.host}
    get credential(){ return this.config.credential}
    get address (){ return this.credential.address}
    get peers(){
        return this.config.peers;
    }

    onConnected(){
        this.signin(this.credential)
    }

    onGranted(data){}

    onDenied(data){}
}