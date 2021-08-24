const cWrapper = require('./src/utils/consoleWrapper')
const P2PNetwork = require('./src/p2p')
const WS = require('./src/communication/wsApi')

const blockchain = require('./src/blockchain')
const kafium = new blockchain.Blockchain()

const config = require('./config.json')

const P2P = P2PNetwork.serveP2P(kafium, {
  port: config.port,
  peerName: config.peerName,
  P2P: config.P2P,
  debug: config.debug
})

P2P.on('ready', function (port) {
  cWrapper.log(`Connected and served P2P networking on ${port}!`)

  if (config.wsApi.enabled) {
    const WSApi = WS.serveWSApi(kafium, config.wsApi.apiPort ?? 2557)

    WSApi.on('ready', function (port) {
      cWrapper.log(`Websocket api is ready on ${port}!`)
    })
  }
})

P2P.on('end', function () {
  cWrapper.log('P2P listener got crashed, restart required...')
  process.end()
})

P2P.on('newPeer', function (peer) {
  cWrapper.log(`Peer connected: ${peer}`)
})

P2P.on('sync', function (block) {
  if (block === 0) return cWrapper.log('Blockchain synchronizing completed!')
  cWrapper.log(`Synchronized ${block} blocks...`)
})

cWrapper.prompt.on('line', function (text) {
  if (text.startsWith('peerList')) {
    const peers = []
    P2P.knownPeers.forEach((key) => { peers.push(key) })

    cWrapper.log(`Known peers: ${peers.join(', ')}`)
  }

  if (text.startsWith('blocks')) {
    kafium.getTotalBlocks().then(count => {
      cWrapper.log(`Total blocks: ${count}`)
    })
  }

  cWrapper.prompt.prompt(true)
})

process.on('uncaughtException', function (err) {
  if (err.stack.includes('read ECONNRESET')) return
  cWrapper.log(err.stack)
})
