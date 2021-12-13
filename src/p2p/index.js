const EventEmitter = require('events').EventEmitter
const net = require('net')

const socketUtils = require('../utils/socket')
const bUtils = require('../blockchain')

module.exports = {
  serveP2P
}

function serveP2P (kafium, options) {
  const p2p = new EventEmitter()

  const knownPeers = new Set()
  const jailedBlocks = new Map()

  if (options.P2P) {
    const p2pSetup = new net.Socket()

    p2pSetup.connect(options.P2P.split(':')[1], options.P2P.split(':')[0], function () {
      p2pSetup.write(`newPeer/${options.peerName}|${options.port}&&`)
      p2pSetup.write(`requestPeers&&`)
      p2pSetup.write(`requestBlockSync&&`)

      knownPeers.add({peerName: 'InitialiserP2P', ipAddress: options.P2P.split(':')[0], port: options.P2P.split(':')[1]})
      
      p2pSetup.on('data', function (data) {
        const packet = data.toString().split('&&')

        packet.forEach(data => {
          if (!data) return
          if (data.startsWith('connectablePeer')) {
            const peerData = {}
            peerData.peerName = data.split('/')[1].split('|')[0]
            peerData.ipAddress = data.split('/')[1].split('|')[1].split(':')[0]
            peerData.port = data.split('/')[1].split('|')[1].split(':')[1]

            knownPeers.add(peerData)
            p2p.emit('newPeer', peerData)
          }

          if (data.startsWith('Block/')) { // Prob broken fix this
            const updatedBlock = bUtils.Block.importFromJSON(JSON.parse(data.replace('Block/', '')))
            updatedBlock.signTransaction(JSON.parse(data.replace('Block/', '')).signature)

            const targetBlock = bUtils.Block.importFromJSON(updatedBlock.toData())
            targetBlock.linkBlock(updatedBlock.hash)
            targetBlock.previousHash = kafium.getLatestBlock(targetBlock.receiver).hash
      
            kafium.addBlock(updatedBlock.sender, updatedBlock)
            kafium.addBlock(targetBlock.receiver, targetBlock)
          }
        })
      })
    })

    knownPeers.forEach(peer => {
      const p2pWriter = new net.Socket()
      p2pWriter.connect(peer.port, peer.ipAddress, function () {
        p2pWriter.write(`newPeer/${options.peerName}|${options.port}&&`, (err) => {
          if (err) throw err
          p2pWriter.end()
        })
      })
    })
  }

  const server = new net.Server()

  server.on('listening', function () {
    p2p.emit('ready', options.port)
  })

  server.on('error', function (err) {
    p2p.emit('error', err)
    p2p.emit('end')
  })

  server.on('close', function () {
    p2p.emit('end')
  })

  server.on('connection', function (socket) {
    let auth

    socket.on('data', function (data) {
      const packet = data.toString().split('&&')
      packet.forEach(data => {
        if (!data) return
        if (data.startsWith('declareMe/')) {
          auth = `${data.split('/')[1]}`
        }

        if (data.startsWith('newPeer/')) {
          const args = data.split('/')[1].split('|')
          if (!args) return socket.write('Error/NeedAPeerName&&')

          const peerData = {}
          peerData.peerName = data.split('/')[1].split('|')[0]
          peerData.ipAddress = socket.remoteAddress.replace('::ffff:', '')
          peerData.port = data.split('/')[1].split('|')[1]

          auth = `${data.split('/')[1]}`

          if (knownPeers.has(peerData)) return
          knownPeers.add(peerData)
          p2p.emit('newPeer', peerData)
        }

        if (data.startsWith('requestPeers')) {
          for (const peer of knownPeers) {
            if (peer.ipAddress === socket.remoteAddress.replace('::ffff:', '')) return
            socket.write(`connectablePeer/${peer.peerName}|${peer.ipAddress}:${peer.port}&&`)
          }
        }

        if (data.startsWith('requestBlockSync')) {
          if (!auth) return
          kafium.sql.prepare("SELECT name FROM sqlite_master WHERE type='table';").all().forEach(table => {
            kafium.sql.prepare(`SELECT * FROM ${table.name};`).all().forEach((block, index, array) => {
              if (block === kafium.createGenesisBlock().toData()) return
              if (typeof block.blockLink === 'object') return
              socketUtils.wait(index * 50).then(function () {
                socket.write(`Block/${JSON.stringify(block)}&&`)
              })
            })
          })
        }

        if (data.startsWith('updatedQueue/')) {
          if (!auth) return
          if (!jailedBlocks.has(data.split('/')[1])) {
            const p2pRequest = new net.Socket()
            p2pRequest.connect(auth.split('|')[1].split(':')[1], socket.remoteAddress.replace('::ffff:', ''), function () {
              p2pRequest.write(`requestBlock/${data.split('/')[1]}`)
              socketUtils.waitForData(p2pRequest, 'requestedBlock').then(data => {
                const updatedBlock = bUtils.Block.importFromJSON(JSON.parse(data.toString().replace('requestedBlock/', '').replace('&&', '')))
                updatedBlock.signTransactionManually(JSON.parse(data.toString().replace('requestedBlock/', '').replace('&&', '')).signature)
                kafium.queueBlock(updatedBlock)
              })
            })
          }
        }

        if (data.startsWith('requestBlock/')) {
          const block = kafium.sql.prepare('SELECT * FROM blockchain WHERE rowid = ?;').get(parseInt(data.split('/')[1]))
          socket.write(`requestedBlock/${JSON.stringify(block)}&&`)
        }
      })
    })
  })

  kafium.on('newBlockRequest', function (block) {
    knownPeers.broadcast(`updatedQueue/${block.hash}&&`)
    kafium.checkBlock(block).then(() => {
      const targetBlock = bUtils.Block.importFromJSON(block.toData())
      targetBlock.previousHash = kafium.getLatestBlock(targetBlock.receiver)?.hash ?? ""
      targetBlock.linkBlock(block.calculateHash())
      block.linkBlock(targetBlock.calculateHash())
      
      kafium.addBlock(block.sender, block)
      kafium.addBlock(targetBlock.receiver, targetBlock)
    }).catch(err => { console.log(err) })
  })

  knownPeers.broadcast = function (data) {
    this.forEach(function (peer) {
      const p2pIpAddress = peer.split('|')[1]
      const p2pClient = new net.Socket()
      p2pClient.connect(p2pIpAddress.split(':')[1], p2pIpAddress.split(':')[0], function () {
        p2pClient.write(`declareMe/${options.peerName}|${options.port}&&`, (err) => {
          if (err) throw err
          p2pClient.write(`${data}&&`, (err) => {
            if (err) throw err
            p2pClient.end()
          })
        })
      })
    })
  }

  p2p.end = function () {
    server.close()
    server.removeAllListeners()
  }

  p2p.knownPeers = knownPeers

  server.listen(options.port)

  return p2p
}
