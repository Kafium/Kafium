const cWrapper = require('./src/utils/consoleWrapper')
const p2pNetwork = require('./src/p2p')
const RPCApi = require('./src/node/rpcApi')

const BlockLattice = require('./src/ledger/BlockLattice')
const kafium = new BlockLattice()

const config = require('./config.json')

const P2P = p2pNetwork.serveP2P(kafium, {
  port: config.port,
  peerName: config.peerName,
  P2P: config.P2P,
  debug: config.debug
})

P2P.on('ready', function (port) {
  cWrapper.log(`Connected and served P2P networking on ${port}!`)

  if (config.rpcApi.enabled) {
    const RPC = new RPCApi(kafium, config.rpcApi.apiPort)

    cWrapper.log(`RPC api listening on ${config.rpcApi.apiPort}`)
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

process.on('uncaughtException', function (err) {
  if (err.stack.includes('read ECONNRESET')) return
  cWrapper.log(err.stack)
})
