const EventEmitter = require('events').EventEmitter
const crypto = require('crypto')

const curve = require('noble-ed25519')

const SQLite = require('better-sqlite3')

const uint8 = require('../utils/uint8')

class txBlock {
  constructor (data) {
    this.previousHash = data.previousHash
    this.timestamp = data.timestamp
    this.sender = data.sender
    this.receiver = data.receiver
    this.amount = data.amount
    this.hash = this.calculateHash()
  }

  calculateHash () {
    return crypto.createHash('ripemd160').update(this.timestamp + this.previousHash + this.sender + this.receiver + this.amount).digest('hex')
  }

  toSqlData () {
    return { hash: this.calculateHash(), timestamp: this.timestamp, previousHash: this.previousHash, sender: this.sender, receiver: this.receiver, amount: this.amount, signature: this.signature }
  }

  toData () {
    return `{
  "hash": "${this.hash}",
  "timestamp": ${this.timestamp},
  "previousHash": "${this.previousHash}",
  "sender": "${this.sender}",
  "receiver": "${this.receiver}",
  "amount": ${this.amount},
  "signature": "${this.signature}"
}`
  }

  static importFromJSON (JSONBlock) {
    const block = new Block({ timestamp: JSONBlock.timestamp, previousHash: JSONBlock.previousHash, sender: JSONBlock.sender, receiver: JSONBlock.receiver, amount: JSONBlock.amount })
    return block
  }

  signTransactionManually (signature) {
    this.signature = signature
  }

  isValid () {
    return new Promise((resolve, reject) => {
      if (!this.sender.startsWith('kX') || !this.receiver.startsWith('kX')) return reject('INVALID_WALLET')
      if (this.sender === this.receiver) return reject('SELF_SEND_PROHIBITED')

      if (!this.signature || this.signature.length === 0) {
        reject('NO_SIGNATURE')
      }

      curve.verify(this.signature, this.calculateHash(), uint8.hexToUint8(this.sender.replace('K#', ''))).then(bool => {
        resolve(bool)
      })
    })
  }
}

class Blockchain extends EventEmitter {
  constructor () {
    super()

    this.sql = new SQLite('./storage/blockchain.sqlite')
    const table = this.sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'blockchain';").get()
    if (!table['count(*)']) {
      this.sql.prepare('CREATE TABLE blockchain (hash TEXT, timestamp INTEGER, previousHash TEXT, sender TEXT, receiver TEXT, amount INT, signature TEXT);').run()
      this.sql.prepare('CREATE UNIQUE INDEX block_hash ON blockchain (hash);').run()
      this.sql.pragma('synchronous = 1')

      this.sql.prepare('INSERT INTO blockchain (hash, timestamp, previousHash, sender, receiver, amount, signature) VALUES (@hash, @timestamp, @previousHash, @sender, @receiver, @amount, @signature);').run(this.createGenesisBlock().toSqlData())
    }

    setInterval(() => {
      
    }, 1000)
  }

  getTotalBlocks () {
    const res = this.sql.prepare('SELECT count(*) FROM \'blockchain\';').get()
    return res['count(*)']
  }

  createGenesisBlock () {
    return new txBlock({ timestamp: 1609448400, previousHash: '', sender: 'GENESIS', receiver: 'K#bdf5d0776f2bd16708351636c95f0590aa3f69ea37b9a22c3f5594f22a387c96', amount: 100000000000})
  }

  getLatestBlock () {
    return this.sql.prepare('SELECT * FROM blockchain ORDER BY hash DESC LIMIT 1;').get()
  }

  getBlockByHash (hash) {
    return this.sql.prepare('SELECT * FROM blockchain WHERE hash = ?').get(hash)
  }

  addBlock (block) {
    return new Promise((resolve, reject) => {
      block.isValid().then(valid => {
        if (valid === true) {
          if (block.amount <= this.getBalanceOfAddress(block.sender)) {
            if (Math.sign(block.amount) === 1) {
              this.sql.prepare('INSERT INTO blockchain (hash, timestamp, previousHash, sender, receiver, amount, signature, external) VALUES (@hash, @epochElapsed, @previousHash, @sender, @receiver, @amount, @signature);').run(block.toSqlData())
              this.emit('newBlock', block)
              resolve(block)
            } else { reject('INVALID_AMOUNT') }
          } else { reject('INSUFFICENT_BALANCE') }
        } else { reject('NOT_VALID') }
      }).catch(err => { reject(err) })
    })
  }

  getBalanceOfAddress (address) {
    let balance = 0

    const blocksInteracted = this.sql.prepare('SELECT * FROM blockchain WHERE receiver = ? OR sender = ?').all(address, address)

    blocksInteracted.forEach(block => {
      if (block.receiver === address) {
        balance += block.amount
      }

      if (block.sender === address) {
        balance -= block.amount
      }
    })

    return balance
  }

  isChainValid () { // TODO: Fix this.
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
  txBlock
}
