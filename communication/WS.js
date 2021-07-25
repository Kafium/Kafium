const EventEmitter = require('events').EventEmitter
const WebSocket = require('ws')

module.exports = {
  serveWSApi
}

function serveWSApi (kafium, port) {
  const wss = new WebSocket.Server({ port: port })
  const wssEmitter = new EventEmitter

  wss.on('listening', function () {
    wssEmitter.emit('ready', port)
  })

  wss.on('connection', function (ws) {
    ws.on('message', function (data) {
      if (data.startsWith('getBlockByHash/')) {
        ws.send(`Block/${kafium.getBlockByHash(data.split('/')[1]).toData()}`)
      }

      if (data.startsWith('getWalletBalance/')) {
        ws.send(`walletBalance/${kafium.getBalanceOfAddress(data.split('/')[1])}`)
      }

      if (data.startsWith('getBlocksCount')) {
        ws.send(`blocksCount/${kafium.getTotalBlocks()}`)
      }

      if (data.startsWith('getLastHash')) {
        ws.send(`lastHash/${kafium.getLatestBlock().hash}`)
      }
    })
  })
  
  return wssEmitter
}