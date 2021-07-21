const EventEmitter = require('events').EventEmitter
const crypto = require('crypto')

const curve = require('noble-ed25519')
const R = require('ramda')

const uint8 = require('../utils/uint8')

class Block {
  constructor (previousHash, epochElapsed, type, data) {
    this.previousHash = previousHash
    this.epochElapsed = epochElapsed
    this.type = type
    this.hash = this.calculateHash()
    this.data = {}

    if (this.type === 'TRANSACTION') {
      this.data.sender = data.sender
      this.data.receiver = data.receiver
      this.data.amount = data.amount
    }

    this.data.external = data.external ?? undefined
  }

  calculateHash () {
    return crypto.createHash('ripemd160').update(this.previousHash + this.epochElapsed + this.type + (this.data?.sender ?? '') + (this.data?.receiver ?? '') + (this.data?.amount ?? '')).digest('hex')
  }

  toData () {
    return `{
  "previousHash": "${this.previousHash}",
  "epochElapsed": ${this.epochElapsed},
  "type": "${this.type}",
  "hash": "${this.hash}",
  "data": {
    "sender": "${this.data.sender ?? 'undefined'}",
    "receiver": "${this.data.receiver ?? 'undefined'}",
    "amount": ${this.data.amount ?? 'undefined'},
    "signature": "${this.data.signature ?? 'undefined'}",
    "external": "${this.data.external ?? 'undefined'}"
  }
}`
  }

  static importFromJSON (JSONBlock) {
    let block = new Block(JSONBlock.previousHash, JSONBlock.epochElapsed, JSONBlock.type, JSONBlock.data);
    block.hash = JSONBlock.hash
    return block
  }

  signTransactionManually (signature) {
    if (!this.type === 'TRANSACTION') throw new Error('Cannot sign transaction, its not a transaction block!')
    this.data.signature = signature
  }

  isValid () {
    return new Promise((resolve, reject) => {
      if (!this.type === 'TRANSACTION') return reject('ONLY_TRANSACTION')
      if (this.data.sender === this.data.receiver) return reject('SELF_SEND_PROHIBITED')

      if (!this.data.signature || this.data.signature.length === 0) {
        reject('NO_SIGNATURE')
      }
  
      curve.verify(this.data.signature, this.calculateHash(), uint8.hexToUint8(this.data.sender)).then(bool => {
        resolve(bool)
      })
    })
  }
}

class Blockchain extends EventEmitter {
  constructor () {
    super()
    this.chain = [ this.createGenesisBlock() ]
  }

  createGenesisBlock () {
    return new Block('0', Date.now(), 'TRANSACTION', { sender: 'GENESIS', receiver: 'bdf5d0776f2bd16708351636c95f0590aa3f69ea37b9a22c3f5594f22a387c96', amount: 10000000000 })
  }

  getLatestBlock () {
    return this.chain[this.chain.length - 1]
  }

  getBlockByHash (hash) {
    return R.find(R.propEq('hash', hash), this.chain)
  }

  addBlock (block) {
    return new Promise((resolve, reject) => {
      if (block.type === 'TRANSACTION') {
        block.isValid().then(valid => {
          if (valid === true) {
              if(block.data.amount <= this.getBalanceOfAddress(block.data.sender)) {
                if(Math.sign(block.data.amount) === 1) {
                  this.chain.push(block)
                  this.emit('newBlock', block)
                  resolve(block)
                } else { reject('INVALID_AMOUNT') }
              } else { reject('INSUFFICENT_BALANCE') }
          } else { reject('NOT_VALID') }
        }).catch(err => { reject(err) })
      }
    })
  }

  getBalanceOfAddress (address) {
    let balance = 0

    for (const block of this.chain) {
      if (!block.type === 'TRANSACTION') return
      if (block.data.sender === address) {
        balance -= block.data.amount
      }

      if (block.data.receiver === address) {
        balance += block.data.amount
      }
    }

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

      if (!currentBlock.hasValidTransactions()) {
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
