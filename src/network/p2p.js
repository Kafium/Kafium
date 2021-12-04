const kafiumJS = require('kafiumjs')

const events = require('events')
const dgram = require('dgram')

class P2P extends events.EventEmitter {
  constructor(settings) {
    super()
    this.knownPeers = []

    const wallet = new kafiumJS.wallet.Wallet(settings.privateKey)

    const server = dgram.createSocket('udp4')

    server.on('listening', () => {
      const address = server.address()

      this.emit('ready', { ipAddress: address.address, port: settings.port })
    })

    server.on('error', (err) => {
      console.log(`UDP server error:\n${err.stack}`)
    })

    this.nodeData = {
      nodeStatus: 0,
      nodeStatue: 0
    }

    if (typeof settings.frontier === "undefined") {
      this.nodeData.nodeStatus = 1
    }

    server.bind(settings.port)
  }
}

module.exports = P2P