const crypto = require('crypto')
const EC = require('elliptic').ec
const ec = new EC('p224')
const R = require('ramda')

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

    this.data.external = data.external
  }

  calculateHash () {
    return crypto.createHash('whirlpool').update(this.previousHash + this.epochElapsed + this.type + (this.data?.sender ?? '') + (this.data?.receiver ?? '') + (this.data?.amount ?? '')).digest('hex')
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

  toOnelineData () {
    return `{ "previousHash": "${this.previousHash}", "epochElapsed": ${this.epochElapsed}, "type": "${this.type}", "hash": "${this.hash}", "data": {"sender": "${this.data.sender ?? 'undefined'}", "receiver": "${this.data.receiver ?? 'undefined'}", "amount": ${this.data.amount ?? 'undefined'}, "signature": "${this.data.signature ?? 'undefined'}", "external": "${this.data.external ?? 'undefined'}"}}`
  }

  signTransaction (signingKey) {
    if (!this.type === 'TRANSACTION') throw new Error('Cannot sign transaction, its not a transaction block!')
    if (signingKey.getPublic('hex') !== this.data.sender) {
      throw new Error('You cannot sign transactions for other wallets!')
    }

    const hashTx = this.calculateHash()
    const sig = signingKey.sign(hashTx, 'base64')

    this.data.signature = sig.toDER('hex')
  }

  signTransactionManually (signature) {
    if (!this.type === 'TRANSACTION') throw new Error('Cannot sign transaction, its not a transaction block!')
    this.data.signature = signature
  }

  isValid () {
    if (this.fromAddress === null) return true

    if (!this.data.signature || this.data.signature.length === 0) {
      throw new Error('No signature in this transaction block')
    }

    const publicKey = ec.keyFromPublic(this.data.sender, 'hex')
    return publicKey.verify(this.calculateHash(), this.data.signature)
  }
}

class Blockchain {
  constructor () {
    this.chain = [this.createGenesisBlock()]
  }

  createGenesisBlock () {
    return new Block('0', Date.now(), 'TRANSACTION', { sender: 'GENESIS', receiver: '0412d19953e65c67359d79cb37e4b20d4b5e211afe62125e9ffdb331f62ef35002dbb6a7d8d7ca538f480320b090d0f9e7dcbb785d7a24d86c', amount: 100000000 })
  }

  getLatestBlock () {
    return this.chain[this.chain.length - 1]
  }

  getBlockByHash (hash) {
    return R.find(R.propEq('hash', hash), this.chain)
  }

  addBlock (block) {
    if(block.isValid() === true) {
      this.chain.push(block)
    } else {
      throw new Error('Block is not valid!?')
    }
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
