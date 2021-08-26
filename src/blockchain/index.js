const EventEmitter = require('events').EventEmitter
const crypto = require('crypto')

const curve = require('noble-ed25519')
const SQLite = require('better-sqlite3')

const uint8 = require('../utils/uint8')

class Block {
  constructor (type, previousHash, sender, scriptSig, receiver, amount, timestamp) {
    this.blockType = type

    this.timestamp = timestamp ?? Date.now()
    this.previousHash = previousHash

    this.sender = sender
    this.scriptSig = scriptSig

    if (type === '0x01') {
      this.receiver = receiver
      this.amount = amount
      this.blockLink = null
    }

    this.nonce = null

    this.hash = this.calculateHash()
  }

  calculateHash () {
    if (this.blockType === '0x01') {
      return crypto.createHash('ripemd160').update(this.timestamp + this.previousHash + this.sender + this.receiver + this.amount).digest('hex')
    }
  }

  updateNonce(nonce) {
    this.nonce = nonce
  }
  
  updateHash () {
    this.hash = this.calculateHash()
  }

  toData () {
    if (this.blockType === '0x01') {
      return { blockType: this.blockType, hash: this.calculateHash(), timestamp: this.timestamp, previousHash: this.previousHash, sender: this.sender, scriptSig: this.scriptSig, receiver: this.receiver, amount: this.amount, blockLink: this.blockLink, signature: this.signature }
    }
  }

  static importFromJSON (JSONBlock) {
    const block = new Block(JSONBlock.blockType, JSONBlock.previousHash, JSONBlock.sender, JSONBlock.scriptSig, JSONBlock.receiver, JSONBlock.amount)
    return block
  }

  signTransaction (signature) {
    this.signature = signature
  }

  linkBlock (hash) {
    this.blockLink = hash
  }

  isValid () {
    return new Promise((resolve, reject) => {
      if (this.blockType === '0x01') {
        if (!this.sender.startsWith('kX') || !this.receiver.startsWith('kX')) return reject('WALLET_PREFIX')
        if (!this.sender.length === 48 || !this.receiver.length === 48) return reject('WALLET_LENGTH')
        if (('kX'+crypto.createHash('ripemd160').update(this.scriptSig).digest('hex')+this.scriptSig.slice(-6)) !== this.sender) return reject('SCRIPTSIG')
        if (this.sender === 'kX0000000000000000000000000000000000000000000000') return reject('BURN_ADDRESS')
        if (this.sender === this.receiver) return reject('SELF_SEND_PROHIBITED')

        if (!this.signature || this.signature.length === 0) {
          reject('NO_SIGNATURE')
        }

        curve.verify(this.signature, this.calculateHash(), uint8.hexToUint8(this.scriptSig)).then(bool => {
          resolve(bool)
        })
      } else {
        reject('INVALID_BLOCKTYPE')
      }
    })
  }
}

class Blockchain extends EventEmitter {
  constructor () {
    super()

    this.sql = new SQLite('./data/blockchain.db')

    const genesisReceiver = this.createGenesisBlock().receiver
    const table = this.sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(genesisReceiver)
    if (!table['count(*)']) {
      this.sql.prepare(`CREATE TABLE ${genesisReceiver} (blockType TEXT, hash TEXT, timestamp INTEGER, previousHash TEXT, sender TEXT, scriptSig TEXT, receiver TEXT, amount INTEGER, blockLink TEXT, signature TEXT);`).run()
      this.sql.prepare(`CREATE UNIQUE INDEX ${genesisReceiver}_chain ON ${genesisReceiver} (hash);`).run()
      this.sql.pragma('synchronous = 1')

      this.sql.prepare(`INSERT INTO ${genesisReceiver} (blockType, hash, timestamp, previousHash, sender, scriptSig, receiver, amount, blockLink, signature) VALUES (@blockType, @hash, @timestamp, @previousHash, @sender, @scriptSig, @receiver, @amount, @blockLink, @signature);`).run(this.createGenesisBlock().toData())
    }
  }

  async getTotalBlocks () {
    let blockCount = 0
    this.sql.prepare("Select name from sqlite_master where type='table'").all().forEach(table => {
      const blocks = this.sql.prepare(`SELECT count(*) FROM '${table.name}';`).get()
      blockCount += blocks['count(*)']
    })

    return blockCount
  }

  createGenesisBlock () {
    return new Block('0x01', null, 'kXgenesis', null, 'kX862110fe26717deb247424a8d8fe3796a311faf0387c96', 10000000000000)
  }

  getLatestBlock (publicKey) {
    const table = this.sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(publicKey)
    if (!table['count(*)']) {
      return ''
    } else {
      return this.sql.prepare(`SELECT * FROM ${publicKey} ORDER BY hash DESC LIMIT 1;`).get()
    }
  }

  async getBlockByHash (hash) {
    this.sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().forEach(table => {
      const findHash = this.sql.prepare('SELECT * FROM blockchain WHERE hash = ?').get(hash)
      if (typeof findHash !== 'undefined') { return findHash }
    })

    return 'NOT_FOUND'
  }

  queueBlock (block) {
    return new Promise((resolve, reject) => {
      this.emit('newBlockRequest', block)
      this.on('newBlock', function (newBlock) {
        if (newBlock === block) {
          resolve(block)
        }
      })
    })
  }

  checkBlock (block) {
    return new Promise((resolve, reject) => {
      block.isValid().then(valid => {
        if (valid === true) {
          if (block.amount <= this.getBalanceOfAddress(block.sender)) {
            if (Math.sign(block.amount) === 1) {
              resolve(true)
            } else { reject('INVALID_AMOUNT') }
          } else { reject('INSUFFICENT_BALANCE') }
        } else { reject('NOT_VALID') }
      }).catch(err => { reject(err) })
    })
  }

  addBlock (publicKey, block) {
    const table = this.sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(publicKey)
    if (!table['count(*)']) {
      this.sql.prepare(`CREATE TABLE ${publicKey} (blockType TEXT, hash TEXT, timestamp INTEGER, previousHash TEXT, sender TEXT, scriptSig TEXT, receiver TEXT, amount FLOAT, blockLink TEXT, signature TEXT);`).run()
      this.sql.prepare(`CREATE UNIQUE INDEX ${publicKey}_chain ON ${publicKey} (hash);`).run()

      this.sql.prepare(`INSERT INTO ${publicKey} (blockType, hash, timestamp, previousHash, sender, scriptSig, receiver, amount, blockLink, signature) VALUES (@hash, @timestamp, @previousHash, @sender, @scriptSig, @receiver, @amount, @blockLink, @signature);`).run(block.toData())
    } else {
      this.sql.prepare(`INSERT INTO ${publicKey} (blockType, hash, timestamp, previousHash, sender, scriptSig, receiver, amount, blockLink, signature) VALUES (@hash, @timestamp, @previousHash, @sender, @scriptSig, @receiver, @amount, @blockLink, @signature);`).run(block.toData())
    }
    this.emit('newBlock', block)
  }

  getBalanceOfAddress (address) {
    let balance = 0

    const sqlExists = this.sql.prepare(`SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?;`).get(address)
    if (sqlExists['count(*)'] === 0) {
    } else {
      const blocksInteracted = this.sql.prepare(`SELECT * FROM ${address} WHERE receiver = ? OR sender = ?`).all(address, address)

      blocksInteracted.forEach(block => {
        if (block.receiver === address) {
          balance += block.amount
        }
  
        if (block.sender === address) {
          balance -= block.amount
        }
      })
    }

    return balance
  }

  isChainValid (publicKey) { // TODO: Fix this.
    const realGenesis = JSON.stringify(this.createGenesisBlock())

    if (realGenesis !== JSON.stringify(this.chain[0])) {
      return false
    }

    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i]
      const previousBlock = this.chain[i - 1]

      if (previousBlock.hash !== currentBlock.previousHash) {
        return false
      }

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false
      }
    }

    return true
  }
}

module.exports = {
  Blockchain,
  Block
}
