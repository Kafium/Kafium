const EventEmitter = require('events').EventEmitter
const net = require('net')
const bUtils = require('../chain/blockchain')

module.exports = {
  serveTCPApi
}

function serveTCPApi (kafium, port) {
  const server = new net.Server()
  const p2p = new EventEmitter()

  server.on('listening', function () {
    p2p.emit('ready', port)
  })

  server.on('error', function (err) {
    p2p.emit('error', err)
    p2p.emit('end')
  })

  server.on('close', function () {
    p2p.emit('end')
  })

  server.on('connection', function (socket) {
    p2p.emit('apiConnect', socket)
    socket.on('data', function (data) {
      const packet = data.toString().split('&&')
      packet.forEach(data => {
        if (!data) return
        if (data.startsWith('getWalletData/')) { // TCP Api : getWalletData (wallet)
          socket.write(`walletData/${kafium.getBalanceOfAddress(data.split('/')[1])}&&`)
        }

        if (data.startsWith('getBlockByHash/')) {
          socket.write(`Block/${kafium.getBlockByHash(data.split('/')[1]).toData()}&&`)
        }

        if (data.startsWith('getLastHash')) { // TCP Api : getLastHash
          socket.write(`lastHash/${kafium.getLatestBlock().hash}&&`)
        }

        if (data.startsWith('newTransaction/')) { // TCP Api : newTransaction
          const args = data.replace('newTransaction/', '').split('|')
          const sender = args[0],
                receiver = args[1],
                amount = args[2],
                signature = args[3],
                createdAt = args[4]

          const block = new bUtils.Block(kafium.getLatestBlock().hash, parseInt(createdAt), 'TRANSACTION', { sender: sender, receiver: receiver, amount: parseInt(amount) })
          block.signTransactionManually(signature)
          kafium.addBlock(block).then(block => {
            socket.write('transactionSuccess&&')
          }).catch((error) => {
            socket.write(`Error/${error}&&`)
          })
        }
      })
    })
  })

  p2p.end = function () {
    server.close()
    server.removeAllListeners()
  }

  server.listen(port)
  return p2p
}
