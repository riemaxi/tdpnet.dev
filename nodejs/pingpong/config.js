module.exports = {
    pinpon: {
        host: 'ws://213.199.34.255:5000', 
        credential: {
                accesskey: 'PINPON',
                password: '000000',
                address: 'pinpon.aladino.maya.4da',
                context: {}
        }
    },
    ponpin: {
        host: 'ws://213.199.34.255:5000', 
        credential: {
                accesskey: 'PONPIN',
                password: '000000',
                address: 'ponpin.aladino.maya.4da',
                context: {}
        },
        peers: {
            pinpon: 'pinpon.aladino.maya.4da'
        }
    },
    punpin: {
        host: 'ws://213.199.34.255:5001', 
        credential: {
                accesskey: 'PUNPIN',
                password: '000000',
                address: 'punpin.aladino.maya.4da',
                context: {}
        },
        peers: {
            pinpon: 'pinpon.aladino.maya.4da'
        }
    }

}

