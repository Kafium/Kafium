const EventEmitter = require('events').EventEmitter
const net = require('net')
const bUtils = require('../chainUtils/blockchain')

module.exports = {
  serveTCPApi
}

function serveTCPApi (kafium, port) {
  const server = new net.Server()
  const p2p = new EventEmitter()

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
    p2p.emit('apiConnect', socket)
    socket.on('data', function (data) {
      const packet = data.toString().split('\n')
      packet.forEach(data => {
        if (!data) return
        if (data.startsWith('getWalletData/')) { // TCP Api : getWalletData (wallet)
          socket.write(`walletData/{"balance": ${kafium.getBalanceOfAddress(data.split('/')[1])}}\n`)
        }

        if (data.startsWith('getBlockByHash/')) {
          socket.write(`Block/${kafium.getBlockByHash(data.split('/')[1]).toOnelineData()}`)
        }

        if (data.startsWith('getLastHash')) { // TCP Api : getLastHash
          socket.write(`lastHash/{"hash": "${kafium.getLatestBlock().hash}"}\n`)
        }

        if (data.startsWith('newTransaction/')) { // TCP Api : newTransaction
          const args = data.replace('newTransaction/', '').split('|')
          const sender = args[0]
          const receiver = args[1]
          const amount = args[2]
          const signature = args[3]
          const createdAt = args[4]
          const block = new bUtils.Block(kafium.getLatestBlock().hash, parseInt(createdAt), 'TRANSACTION', { sender: sender, receiver: receiver, amount: parseInt(amount) })
          block.signTransactionManually(signature)
          if (block.isValid()) {
            kafium.chain.push(block)
            socket.write('transactionSuccess\n')
          }
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
