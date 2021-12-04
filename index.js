const parseArgv = require('./src/utils/argParser')(process.argv)
const P2P = require('./src/network/p2p')

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
})

process.on('uncaughtException', function (err) {
  console.log(err.stack)
})
