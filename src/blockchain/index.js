const EventEmitter = require('events').EventEmitter
const crypto = require('crypto')

const curve = require('noble-ed25519')

const SQLite = require('better-sqlite3')

class Blockchain extends EventEmitter {
  constructor () {
    super()
    
    this.sql = new SQLite('./storage/blockchain.sqlite')
    const table = this.sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'blockchain';").get()
    if (!table['count(*)']) {
      this.sql.prepare('CREATE TABLE blockchain (hash TEXT, blockHeight INT, previousHash TEXT, blockSize INT, includedBlocks TEXT, interactedWallets TEXT, producer TEXT);').run()
      this.sql.prepare('CREATE UNIQUE INDEX block_hash ON blockchain (hash);').run()
      this.sql.pragma('synchronous = 1')

      this.sql.prepare('INSERT INTO blockchain (hash, timestamp, previousHash, sender, receiver, amount, signature) VALUES (@hash, @timestamp, @previousHash, @sender, @receiver, @amount, @signature);').run(this.createGenesisBlock().toSqlData())
    }

    if (!table['count(*)']) {
      this.sql.prepare('CREATE TABLE blockchain (hash TEXT, timestamp INTEGER, previousHash TEXT, sender TEXT, receiver TEXT, amount INT, signature TEXT);').run()
      this.sql.prepare('CREATE UNIQUE INDEX block_hash ON blockchain (hash);').run()
      this.sql.pragma('synchronous = 1')

      this.sql.prepare('INSERT INTO blockchain (hash, timestamp, previousHash, sender, receiver, amount, signature) VALUES (@hash, @timestamp, @previousHash, @sender, @receiver, @amount, @signature);').run(this.createGenesisBlock().toSqlData())
    }
  }

  getTotalBlocks () {
    const res = this.sql.prepare('SELECT count(*) FROM \'blockchain\';').get()
    return res['count(*)']
  }

  createGenesisTx () {
    return new txBlock({ timestamp: 1609448400, previousHash: '', sender: 'kXGENESIS', receiver: 'K#bdf5d0776f2bd16708351636c95f0590aa3f69ea37b9a22c3f5594f22a387c96', amount: 100000000000})
  }

  createBlock () {
    this.sql.prepare('INSERT INTO blockchain (hash, blockHeight, previousHash, blockSize, includedBlocks, interactedWallets, producer) VALUES (@hash, @blockHeight, @previousHash, @blockSize, @includedBlocks, @interactedWallets, @producer);').run()
  }

  getLatestBlock () {
    return this.sql.prepare('SELECT * FROM blockchain ORDER BY hash DESC LIMIT 1;').get()
  }

  getBlockByHash (hash) {
    return this.sql.prepare('SELECT * FROM blockchain WHERE hash = ?').get(hash)
  }

  importTx (blockHash, txBlock) {
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
  Blockchain
}
