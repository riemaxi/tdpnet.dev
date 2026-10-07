# Quick Start Guide

## Installation

Install the required project dependencies using `npm`:

```bash
npm install

```

This installs **`ws`** (WebSocket client library) required for message transport.

---

## Configuration

Ensure a `config.js` file exists in the root directory. It must define connection parameters and credentials for each node (`pinpon`, `ponpin`, `punpin`):

```javascript
module.exports = {
  pinpon: {
    host: 'ws://<SERVER_IP>:<PORT>',
    credential: {
      accesskey: 'PINPON',
      password: '000000',
      address: 'pinpon.aladino.maya.4da',
      context: {}
    }
  },
  ponpin: {
    host: 'ws://<SERVER_IP>:<PORT>',
    credential: {
      accesskey: 'PONPIN',
      password: '000000',
      address: 'ponpin.aladino.maya.4da',
      context: {}
    },
    peers: { pinpon: 'pinpon.aladino.maya.4da' }
  },
  punpin: {
    host: 'ws://<SERVER_IP>:<PORT>',
    credential: {
      accesskey: 'PUNPIN',
      password: '000000',
      address: 'punpin.aladino.maya.4da',
      context: {}
    },
    peers: { pinpon: 'pinpon.aladino.maya.4da' }
  }
};

```

* **`host`**: The target WebSocket server URL.


* **`credential`**: Node identity (`accesskey`, `password`, `address`).


* **`peers`**: Address map for target nodes.



---

## Running the Application

Start the peer network instances:

```bash
node index.js

```

Once granted connection access, nodes automatically begin sending ping/pong requests and logging responses to the console.