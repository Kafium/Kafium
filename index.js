const path = require('path')
const fs = require('fs')

const bcSaver = fs.createWriteStream(`backups/${Date.now()}.kafium`)

const parseArgv = require('./utils/argParser')(process.argv)
const consoleUtils = require('./utils/consoleWrapper')
const P2PNetwork = require('./p2p')
const TCP = require('./communication/tcpApi')

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

kafium.on('newBlock', async function(block) {
  bcSaver.write(`${block.toData()}&&`)
})

consoleUtils.prompt.on('line', function (text) {
  if (text.startsWith('peerList')) {
    const peers = []
    P2P.knownPeers.forEach((key) => { peers.push(key) })

    consoleUtils.log(`Known peers: ${peers.join(', ')}`)
  }

  if (text.startsWith('blocks')) {
    consoleUtils.log(`Total blocks: ${kafium.chain.length}`)
  }

  if (text.startsWith('loadBackup')) {
    consoleUtils.log('Loading backup...')
    let blocks = [kafium.createGenesisBlock()]
    const bc = fs.readFileSync(`backups/${text.split(' ')[1]}.kafium`, 'utf8').split('&&')
    bc.forEach((block, index, array) => {
      if(!block) return
      const updatedBlock = blockchain.Block.importFromJSON(JSON.parse(block))
      blocks[index + 1] = updatedBlock
    })
    kafium.chain = blocks
    consoleUtils.log('Loaded backup succesfully.')
  }

  if (text.startsWith('debug')) {
    console.log(kafium.chain)
  }

  consoleUtils.prompt.prompt(true)
})

process.on('uncaughtException', function (err) {
  if (err.stack.includes('read ECONNRESET')) return
  consoleUtils.log(err.stack)
})
