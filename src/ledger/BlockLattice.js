const EventEmitter = require('events').EventEmitter

const SQLite = require('better-sqlite3')

const KPoW = require('KPoW')
const Block = require('./Block')

module.exports = class BlockLattice extends EventEmitter {
  constructor () {
    super()

    this.sql = new SQLite('./storage/ledger.db')

    const genesisReceiver = this.createGenesisBlock().recipient
    const table = this.sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(genesisReceiver)
    if (!table['count(*)']) {
      this.sql.prepare(`CREATE TABLE ${genesisReceiver} (blockType TEXT, hash TEXT, timestamp INTEGER, previousBlock TEXT, sender TEXT TEXT, recipient TEXT, amount TEXT, blockLink TEXT, work TEXT, signature TEXT);`).run()
      this.sql.pragma('synchronous = 1')

      this.sql.prepare(`INSERT INTO ${genesisReceiver} (blockType, hash, timestamp, previousBlock, sender, recipient, amount, blockLink, work, signature) VALUES (@blockType, @hash, @timestamp, @previousBlock, @sender, @recipient, @amount, @blockLink, @work, @signature);`).run(this.createGenesisBlock().toData())
    }
  }
  
  createGenesisBlock () {
    const genesis = new Block('TRANSFER', { sender: null, recipient: 'kX8KCiriNpMK5QU2Wdc0IEysFqIYAzqUREUuRpT3RxtABe0', amount: 45000000000000000n })
    genesis.updateWork(KPoW.doWork(genesis.hash))
    return genesis
  }

  getTotalBlocks () {
    let blockCount = 0
    this.sql.prepare("Select name from sqlite_master where type='table'").all().forEach(table => {
      const blocks = this.sql.prepare(`SELECT count(*) FROM '${table.name}';`).get()
      blockCount += blocks['count(*)']
    })

    return blockCount
  }

  getTotalBlocksOfLattice (address) {
    const blocks = this.sql.prepare(`SELECT count(*) FROM '${address}';`).get()

    return blocks['count(*)']
  }

  queryChain (address, amount) {
    const table = this.sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(address)
    if (!table['count(*)']) {
      return null
    } else {
      return this.sql.prepare(`SELECT * FROM ${address} ORDER BY timestamp DESC LIMIT ?;`).all(amount)
    }
  }

  getLatestBlock (address) {
    const table = this.sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(address)
    if (!table['count(*)']) {
      return null
    } else {
      return this.sql.prepare(`SELECT * FROM ${address} ORDER BY timestamp DESC LIMIT 1;`).get() ?? null
    }
  }

  getBlockByHash (hash) {
    let block = "NOT_EXISTS"
    this.sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().forEach((table, index, array) => {
      const findHash = this.sql.prepare(`SELECT * FROM ${table.name} WHERE hash = ?`).get(hash)
      if (typeof findHash !== 'undefined') { array.length = index + 1; block = findHash }
    })

    return block
  }

  queueBlock (block) {
    this.emit('newBlockRequest', block)
  }

  checkBlock (block) {
    return new Promise((resolve, reject) => {
      block.isValid().then(valid => {
        if (valid === true) {
          if (block.amount <= this.getBalanceOfAddress(block.sender)) {
            if (Math.sign(block.amount) === 1) {
              if (block.previousBlock === this.getLatestBlock(block.sender)?.hash || block.previousBlock === this.getLatestBlock(block.recipient)?.hash) {
                resolve(true)
              } else { reject('invalid_prevblock') }
            } else { reject('invalid_amount') }
          } else { reject('insufficent_balance') }
        } else { reject('not_valid') }
      }).catch(err => { reject(err) })
    })
  }

  addBlock (address, block) {
    const table = this.sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(address)
    if (!table['count(*)']) {
      this.sql.prepare(`CREATE TABLE ${address} (blockType TEXT, hash TEXT, timestamp INTEGER, previousBlock TEXT, sender TEXT, recipient TEXT, amount TEXT, blockLink TEXT, work TEXT, signature TEXT);`).run()

      this.sql.prepare(`INSERT INTO ${address} (blockType, hash, timestamp, previousBlock, sender, recipient, amount, blockLink, work, signature) VALUES (@blockType, @hash, @timestamp, @previousBlock, @sender, @recipient, @amount, @blockLink, @work, @signature);`).run(block.toData())
    } else {
      try {
        this.sql.prepare(`INSERT INTO ${address} (blockType, hash, timestamp, previousBlock, sender, recipient, amount, blockLink, work, signature) VALUES (@blockType, @hash, @timestamp, @previousBlock, @sender, @recipient, @amount, @blockLink, @work, @signature);`).run(block.toData())
      } catch (err) {}
    }

    this.emit('newBlock', block)
  }

  getBalanceOfAddress (address) {
    let balance = 0n

    const sqlExists = this.sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name=?;').get(address)
    if (sqlExists['count(*)'] === 0) return balance

    const blocksInteracted = this.sql.prepare(`SELECT * FROM ${address} WHERE recipient = ? OR sender = ?`).all(address, address)

    blocksInteracted.forEach(block => {
      if (block.recipient === address) {
        balance += BigInt(block.amount)
      }

      if (block.sender === address) {
        balance -= BigInt(block.amount)
      }
    })

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

      if (previousBlock.hash !== currentBlock.previousBlock) {
        return false
      }

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false
      }
    }

    return true
  }
}
