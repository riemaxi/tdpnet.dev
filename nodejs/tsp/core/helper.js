const {Packet, Channel, Status, Peering, Transformer} = require('./packet')

class Packeter{
    static ONE_OPERATOR = new Int8Array(1)

    static createAd({from, to = '', name, description, status, subject = 'signin'}){
        let data = status ? JSON.stringify({ name : name??from, status, description })
                          : JSON.stringify({ name : name??from, description })

        return this.createSignal({
            from,
            to, 
            data, 
            subject}
        )
    }

    static createSignal({from, to, data, subject, operators, pointer = 0}){
        return new Packet(
            Channel.create('', 0, 1),
            new Status(0, '0000'),
            new Peering(from, to, subject),
            new Transformer(pointer, operators??Packeter.ONE_OPERATOR, data)
        ).toString()
    }

    static createData({channel, status, peering, transformer }){
        return new Packet( 
            channel,
            status,
            peering,
            transformer
        ).toString()
    }
}

module.exports ={
    Packeter
}