const EventEmitter = require('events').EventEmitter
const net = require('net')

const bUtils = require('../blockchain')

const { RateLimiterMemory } = require('rate-limiter-flexible')

module.exports = {
  serveTCPApi
}

function serveTCPApi (kafium, port) {
  const server = new net.Server()
  const p2p = new EventEmitter()

  const rateLimiter = new RateLimiterMemory({
    points: 5,
    duration: 2
  })

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
      packet.forEach(async function (data) {
        if (!data) return
        try {
          await rateLimiter.consume(socket.remoteAddress)
          if (data.startsWith('getWalletBalance/')) {
            if (!data.split('/')[1]) return socket.write('Error/MISSING_ARGS&&')
            socket.write(`walletBalance/${kafium.getBalanceOfAddress(data.split('/')[1])}&&`)
          }

          if (data.startsWith('getWalletBlocks/')) {
            const args = data.split('/')[1].split('|')
            const wallet = args[0]
            const howMuchBlocks = args[1]

            if (!wallet || !howMuchBlocks) return socket.write('Error/MISSING_ARGS&&')

            const sql = kafium.sql.prepare('SELECT * FROM blockchain WHERE receiver = ? OR sender = ? LIMIT ?;').all(wallet, wallet, howMuchBlocks)
            let toSend = ''
            sql.forEach((thing, index, array) => {
              toSend += JSON.stringify(thing) + (index === sql.length - 1 ? '' : '|')
            })

            socket.write(`walletBlocks/${toSend}&&`)
          }

          if (data.startsWith('getBlocksCount')) {
            socket.write(`blocksCount/${kafium.getTotalBlocks()}`)
          }

          if (data.startsWith('getBlockByHash/')) {
            if (!data.split('/')[1]) return socket.write('Error/MISSING_ARGS&&')
            socket.write(`Block/${JSON.stringify(kafium.getBlockByHash(data.split('/')[1]))}&&`)
          }

          if (data.startsWith('getLastHash')) { // TCP Api : getLastHash
            socket.write(`lastHash/${kafium.getLatestBlock().hash}&&`)
          }

          if (data.startsWith('newRawTransaction/')) { // TCP Api : newTransaction
            const args = data.replace('newRawTransaction/', '').split('|')
            const sender = args[0]
            const receiver = args[1]
            const amount = args[2]
            const signature = args[3]
            const createdAt = args[4]

            const block = new bUtils.Block(parseInt(createdAt), kafium.getLatestBlock().hash, sender, receiver, parseInt(amount))
            block.signTransactionManually(signature)
            kafium.addBlock(block).then(block => {
              socket.write('rawTransactionSuccess&&')
            }).catch((error) => {
              socket.write(`Error/${error}&&`)
            })
          }
        } catch (err) {
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
