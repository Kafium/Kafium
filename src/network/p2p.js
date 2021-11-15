const events = require('events')
const dgram = require('dgram')

class KafiumP2P extends events.EventEmitter {
  constructor(kafium, settings) {
    super()

    this.knownPeers = []

    const server = dgram.createSocket('udp4')

    server.on('listening', function () {
      const address = server.address()

      console.log(address)
      this.emit('ready', { ipAddress: address.address, port: settings.port })
    })

    server.on('error', (err) => {
      console.log(`UDP server error:\n${err.stack}`)
    })

    this.nodeData = {
      nodeStatus: 0,
      nodeStatue: 0
    }

    server.bind(settings.port)
  }
} 

module.exports = KafiumP2P