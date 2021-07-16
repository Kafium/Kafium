const net = require('net')
const publicIp = require('public-ip')
const EventEmitter = require('events').EventEmitter

module.exports = {
  serveP2P
}

function serveP2P (kafium, options) {
  const p2p = new EventEmitter()
  const knownPeers = new Set()

  if (options.P2P) {
    const p2pSetup = new net.Socket()

    p2pSetup.connect(options.P2P.split(':')[1], options.P2P.split(':')[0], function () {
      publicIp.v4().then(publicIp => {
        p2pSetup.write(`newPeer/${options.peerName}|${options.debug ? '127.0.0.1' : publicIp}:${options.port}\n`)
      })

      p2pSetup.on('data', function (data) {
        const packet = data.toString().split('\n')
        packet.forEach(data => {
          if (!data) return
          if (data.toString().startsWith('newPeer')) {
            if (knownPeers.has(data.replace('newPeer/', ''))) return
            knownPeers.broadcast(`${data}\n`)
            knownPeers.add(data.replace('newPeer/', ''))
            p2p.emit('newPeer', data.replace('newPeer/', ''))
          }
        })
      })
    })
  }

  const server = new net.Server()

  server.on('listening', function () {
    p2p.emit('ready')
  })

  server.on('error', function (err) {
    p2p.emit('error', err)
    p2p.emit('end')
  })

  server.on('close', function () {
    p2p.emit('end')
  })

  server.on('connection', function (socket) {
    socket.on('data', function (data) {
      const packet = data.toString().split('\n')
      packet.forEach(data => {
        if (!data) return
        if (data.startsWith('newPeer/')) {
          if (knownPeers.has(data.replace('newPeer/', ''))) return
          const args = data.split('/')[1].split('|')
          socket.peerName, socket.ipAddress = args[0], args[1]
          if (!args) return socket.write('Error/NeedAPeerName\n')
          socket.write(`newPeer/${options.peerName}|${options.debug ? '127.0.0.1' : publicIp}:${options.port}\n`)
          for (const peer of knownPeers) {
            socket.write(`newPeer/${peer}\n`)
          }
          knownPeers.broadcast(data)
          knownPeers.add(data.replace('newPeer/', ''))
          p2p.emit('newPeer', data.replace('newPeer/', ''))
        } else {
          console.log(`Sender: ${socket.peerName}`)
          p2p.emit('data', data)
        }
      })
    })
  })

  knownPeers.broadcast = function (data) {
    for (const peer of this) {
      const p2pIpAddress = peer.split('|')[1]
      const p2pClient = new net.Socket()
      p2pClient.connect(p2pIpAddress.split(':')[1], p2pIpAddress.split(':')[0], function () {
        p2pClient.write(data, (err) => {
          if (err) throw err
          p2pClient.end()
        })
      })
    }
  }

  p2p.broadcastData = function (data) {
    knownPeers.broadcast(data)
  }

  p2p.end = function () {
    server.close()
    server.removeAllListeners()
  }

  p2p.knownPeers = knownPeers

  server.listen(options.port)
  return p2p
}
