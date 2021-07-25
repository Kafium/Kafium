const parseArgv = require('./utils/argParser')(process.argv)
const consoleUtils = require('./utils/consoleWrapper')
const P2PNetwork = require('./p2p')
const TCP = require('./communication/TCP')
const WS = require('./communication/WS')

const blockchain = require('./chain/blockchain')
const kafium = new blockchain.Blockchain()

const config = require('./config.json')
const networkingSettings = {}
networkingSettings.port = parseArgv.port ?? config.port ?? 2555
networkingSettings.peerName = parseArgv.peerName ?? config.peerName ?? 'Defaultpeer'
networkingSettings.P2P = parseArgv.P2P ?? config.P2P
networkingSettings.debug = parseArgv.debug ?? config.debug ?? false

let P2P = P2PNetwork.serveP2P(kafium, networkingSettings)

P2P.on('ready', function (port) {
  consoleUtils.log(`Connected and served P2P networking on ${port}!`)
})

P2P.on('end', function () {
  consoleUtils.log('P2P listener got crashed, restarting...')
  P2P.end()
  P2P = P2PNetwork.serveP2P(networkingSettings)
})

P2P.on('newPeer', function (peer) {
  consoleUtils.log(`Peer connected: ${peer}`)
})

if (parseArgv.enableTCPApi || config.tcpApi.enabled) {
  const TCPApi = TCP.serveTCPApi(kafium, parseArgv.tcpApi ?? config.tcpApi.apiPort ?? 2556)

  TCPApi.on('ready', function (port) {
    consoleUtils.log(`TCP socket api is ready on ${port}!`)
  })
}

if (parseArgv.enableWSApi || config.wsApi.enabled) {
  const WSApi = WS.serveWSApi(kafium, parseArgv.WSApi ?? config.tcpApi.apiPort ?? 2557)

  WSApi.on('ready', function (port) {
    consoleUtils.log(`Websocket api is ready on ${port}!`)
  })
}


consoleUtils.prompt.on('line', function (text) {
  if (text.startsWith('peerList')) {
    const peers = []
    P2P.knownPeers.forEach((key) => { peers.push(key) })

    consoleUtils.log(`Known peers: ${peers.join(', ')}`)
  }

  if (text.startsWith('blocks')) {
    consoleUtils.log(`Total blocks: ${kafium.getTotalBlocks()}`)
  }

  consoleUtils.prompt.prompt(true)
})

process.on('uncaughtException', function (err) {
  if (err.stack.includes('read ECONNRESET')) return
  consoleUtils.log(err.stack)
})
