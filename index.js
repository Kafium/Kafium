const parseArgv = require('./src/utils/argParser')(process.argv)
const P2P = require('./src/network/p2p')
const TCP = require('./src/node/TCP')
const WS = require('./src/node/WS')

const blockchain = require('./src/blockchain')
const kafium = new blockchain.Blockchain()

const config = require('./config.json')

const networkingSettings = {}
networkingSettings.port = parseArgv.port ?? config.port ?? 2555
networkingSettings.frontier = parseArgv.frontier ?? config.frontier ?? undefined
networkingSettings.debug = parseArgv.debug ?? config.debug ?? false

const KafiumP2P = new P2P(kafium, networkingSettings)

KafiumP2P.on('ready', (data) => {
  console.log(`Connected and served P2P networking on ${data.port}!`)

  if (parseArgv.enableTCPApi || config.tcpApi.enabled) {
    // const TCPApi = TCP.serveTCPApi(kafium, parseArgv.tcpApi ?? config.tcpApi.apiPort ?? 2556)

    // TCPApi.on('ready', function (port) {
    //  console.log(`TCP socket api is ready on ${port}!`)
    // })
  }

  if (parseArgv.enableWSApi || config.wsApi.enabled) {
    // const WSApi = WS.serveWSApi(kafium, parseArgv.WSApi ?? config.wsApi.apiPort ?? 2557)

    // WSApi.on('ready', function (port) {
    //  console.log(`Websocket api is ready on ${port}!`)
    // })
  }
})

process.on('uncaughtException', function (err) {
  console.log(err.stack)
})
