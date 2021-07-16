const path = require('path')
const fs = require('fs')

const parseArgv = require('./utils/argParser')(process.argv)
const consoleUtils = require('./utils/consoleWrapper')

const P2PNetwork = require('./p2p')
const TCP = require('./communication/tcpApi')

const blockchain = require('./chainUtils/blockchain')

const kafium = new blockchain.Blockchain()

const networkingSettings = {}
networkingSettings.port = parseArgv.port ?? 2555
networkingSettings.peerName = parseArgv.peerName ?? 'Defaultpeer'
networkingSettings.P2P = parseArgv.P2P
networkingSettings.debug = parseArgv.debug ?? false

let P2P = P2PNetwork.serveP2P(kafium, networkingSettings)
const TCPApi = TCP.serveTCPApi(kafium, parseArgv.tcpApi ?? 3344)

P2P.on('ready', function () {
  consoleUtils.log('Connected and served P2P networking.!')
})

P2P.on('end', function () {
  consoleUtils.log('P2P listener got crashed, restarting...')
  P2P.end()
  P2P = P2PNetwork.serveP2P(networkingSettings)
})

P2P.on('newPeer', function (peer) {
  consoleUtils.log(`Peer connected: ${peer}`)
})

P2P.on('data', function (data) {
  consoleUtils.log(`Data received: ${data}`)
})

TCPApi.on('ready', function () {
  consoleUtils.log('TCP socket api is ready!')
})

consoleUtils.prompt.on('line', function (text) {
  if (text.startsWith('sendData')) {
    const data = text.split(' ')
    P2P.broadcastData(data[1])
  }

  if (text.startsWith('peerList')) {
    const peers = []
    P2P.knownPeers.forEach((key) => { peers.push(key) })

    consoleUtils.log(`Known peers: ${peers.join(', ')}`)
  }

  if (text.startsWith('blocks')) {
    let blocksCount = 0
    kafium.chain.forEach(block => { blocksCount++ })
    consoleUtils.log(`Total blocks: ${blocksCount}`)
  }

  if (text.startsWith('createBackup')) {
    consoleUtils.log('Exporting blockchains copy to backups/ file.')
    const now = Date.now()
    fs.appendFile(path.resolve(__dirname, `./backups/backup-${now}.kafium`), '[\n', (err) => {
      if (err) { consoleUtils.log(err) }
      kafium.chain.forEach((block, index) => {
        fs.appendFile(path.resolve(__dirname, `./backups/backup-${now}.kafium`), `${kafium.chain.length - 1 === index ? block.toData() : block.toData() + ','}\n`, (err) => {
          if (err) { consoleUtils.log(err) }
        })
      })
      fs.appendFile(path.resolve(__dirname, `./backups/backup-${now}.kafium`), ']', (err) => {
        if (err) { consoleUtils.log(err) }
      })
      consoleUtils.log(`Created backup! Backup id is ${now}.`)
    })
  }

  if (text.startsWith('loadBackup')) {
    consoleUtils.log('Loading backup...')
    kafium.chain = JSON.parse(fs.readFileSync(`backups/backup-${text.split(' ')[1]}.kafium`, 'utf8'))
    consoleUtils.log('Loaded backup succesfully.')
  }

  if (text.startsWith('debug')) {
    console.log(kafium.chain)
  }

  if (text.startsWith('sendData')) {
    P2P.broadcastData(text.split(' ')[1])
  }

  consoleUtils.prompt.prompt(true)
})

consoleUtils.prompt.on('SIGINT', function() {
  consoleUtils.log('Seems like its closing, creating an auto backup...')
  const now = Date.now()
  fs.appendFile(`backups/backup-${now}.kafium`, '[\n', (err) => {
    if (err) { consoleUtils.log(err) }
    kafium.chain.forEach((block, index) => {
      fs.appendFile(`backups/backup-${now}.kafium`, `${kafium.chain.length - 1 === index ? block.toData() : block.toData() + ','}\n`, (err) => {
        if (err) { consoleUtils.log(err) }
      })
    })
    fs.appendFile(`backups/backup-${now}.kafium`, ']', (err) => {
      if (err) { consoleUtils.log(err) }
    })
    consoleUtils.log(`Created backup! Backup id is ${now}.`)
    process.exit()
  })
})

process.on('uncaughtException', function (err) {
  if (err.stack.includes('read ECONNRESET')) return
  consoleUtils.log(err.stack)
})
