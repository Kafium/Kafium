const EventEmitter = require('events').EventEmitter

const { RateLimiterMemory } = require('rate-limiter-flexible')
const WebSocket = require('ws')

module.exports = {
  serveWSApi
}

function serveWSApi (kafium, port) {
  const wss = new WebSocket.Server({ port: port })
  const wssEmitter = new EventEmitter()

  const rateLimiter = new RateLimiterMemory({
    points: 5,
    duration: 2
  })

  wss.on('listening', function () {
    wssEmitter.emit('ready', port)
  })

  wss.on('connection', function (ws, req) {
    ws.on('message', async function (data) {
      try {
        await rateLimiter.consume(req.socket.remoteAddress)
        if (data.startsWith('getBlockByHash/')) {
          if (!data.split('/')[1]) return socket.write('Error/MISSING_ARGS')
          ws.send(`Block/${JSON.stringify(kafium.getBlockByHash(data.split('/')[1]))}`)
        }

        if (data.startsWith('getWalletBalance/')) {
          if (!data.split('/')[1]) return socket.write('Error/MISSING_ARGS')
          ws.send(`walletBalance/${kafium.getBalanceOfAddress(data.split('/')[1])}`)
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

          ws.send(`walletBlocks/${toSend}`)
        }

        if (data.startsWith('getBlocksCount')) {
          ws.send(`blocksCount/${kafium.getTotalBlocks()}`)
        }

        if (data.startsWith('getLastHash')) {
          ws.send(`lastHash/${kafium.getLatestBlock().hash}`)
        }
      } catch (err) {
      }
    })
  })

  return wssEmitter
}
