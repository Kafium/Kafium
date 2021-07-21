const path = require('path')
const fs = require('fs')

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

if (config.tcpApiEnabled) {
  const TCPApi = TCP.serveTCPApi(kafium, parseArgv.tcpApi ?? config.tcpApiPort ?? 2556)

  TCPApi.on('ready', function (port) {
    consoleUtils.log(`TCP socket api is ready on ${port}!`)
  })
}

consoleUtils.prompt.on('line', function (text) {
  if (text.startsWith('peerList')) {
    const peers = []
    P2P.knownPeers.forEach((key) => { peers.push(key) })

    consoleUtils.log(`Known peers: ${peers.join(', ')}`)
  }

  if (text.startsWith('blocks')) {
    consoleUtils.log(`Total blocks: ${kafium.chain.length}`)
  }

  if (text.startsWith('createBackup')) {
    consoleUtils.log('Exporting blockchains copy to backups/ file.')
    const now = Date.now()
    fs.appendFile(path.resolve(__dirname, `./backups/backup-${now}.kafium`), '[\n', (err) => {
      if (err) { consoleUtils.log(err) }
      kafium.chain.forEach((block, index) => {
        fs.appendFile(path.resolve(__dirname, `./backups/backup-${now}.kafium`), `${kafium.chain.length - 1 === index ? block.toData() : block.toData() + ','}\n`, (err) => {
          if (err) { consoleUtils.log(err) }
          fs.appendFile(path.resolve(__dirname, `./backups/backup-${now}.kafium`), ']', (err) => {
            if (err) { consoleUtils.log(err) }
            consoleUtils.log(`Created backup! Backup id is ${now}.`)
          })
        })
      })
    })
  }

  if (text.startsWith('loadBackup')) {
    consoleUtils.log('Loading backup...')
    const blocks = JSON.parse(fs.readFileSync(`backups/backup-${text.split(' ')[1]}.kafium`, 'utf8'))
    blocks.forEach((block, index, array) => {
      const updatedBlock = blockchain.Block.importFromJSON(block)
      blocks[index] = updatedBlock
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
