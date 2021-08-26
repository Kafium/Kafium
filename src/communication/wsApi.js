const EventEmitter = require('events').EventEmitter

const { RateLimiterMemory } = require('rate-limiter-flexible')
const WebSocket = require('ws')

const { Block } = require('../blockchain')

module.exports = {
  serveWSApi
}

function serveWSApi (kafium, port) {
  const wss = new WebSocket.Server({ port: port })
  const wssEmitter = new EventEmitter()

  const rateLimiter = new RateLimiterMemory({
    points: 4,
    duration: 2
  })

  wss.on('listening', function () {
    wssEmitter.emit('ready', port)
  })

  wss.on('connection', function (ws, req) {
    ws.on('message', async function (data) {
      try {
        await rateLimiter.consume(req.socket.remoteAddress)
        if (data.startsWith('getBlockByHash:')) {
          if (!data.split(':')[1]) return ws.send('Error:MISSING_ARGS')
          kafium.getBlockByHash(data.split(':')[1]).then(block => {
            ws.send(`Block:${JSON.stringify(kafium.getBlockByHash(data.split(':')[1]))}`)
          })
        }

        if (data.startsWith('getWalletBalance:')) {
          if (!data.split(':')[1]) return ws.send('Error:MISSING_ARGS')
          ws.send(`walletBalance:${kafium.getBalanceOfAddress(data.split(':')[1])}`)
        }

        if (data.startsWith('getWalletBlockchain:')) {
          const args = data.split(':')[1].split('|')
          const wallet = args[0]
          const howMuchBlocks = args[1]

          if (!wallet || !howMuchBlocks) return ws.send('Error:MISSING_ARGS')

          const sql = kafium.sql.prepare(`SELECT * FROM ${wallet} LIMIT ?;`).all(howMuchBlocks)
          let toSend = ''
          sql.forEach((thing, index, array) => {
            toSend += JSON.stringify(thing) + (index === sql.length - 1 ? '' : '|')
          })

          ws.send(`walletBlockchain:${toSend}`)
        }

        if (data.startsWith('getBlocksCount')) {
          kafium.getTotalBlocks().then(count => {
            ws.send(`blocksCount:${count}`)
          })
        }

        if (data.startsWith('newRawTransaction')) {
          const args = data.split(':')[1].split('|'),
                createdAt = args[0],
                sender = args[1],
                scriptSig = args[2],
                receiver = args[3],
                amount = args[4],
                signature = args[5]
          const hash = kafium.getLatestBlock(sender).hash
          const receivedBlock = new Block('0x01', hash, sender, scriptSig, receiver, parseInt(amount), parseInt(createdAt))
          receivedBlock.signTransaction(signature)
          kafium.queueBlock(receivedBlock)
          ws.send('queuedSuccess')
        }

        if (data.startsWith('getLastHash:')) {
          const wallet = data.split(':')[1]
          if (!wallet) return ws.send('Error:MISSING_ARGS')
          ws.send(`lastHash:${kafium.getLatestBlock(wallet.replace('K#', '')).hash}`)
        }
      } catch (err) { }
    })
  })

  return wssEmitter
}
