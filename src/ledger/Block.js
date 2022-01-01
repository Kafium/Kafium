const crypto = require('crypto')

const tweetnacl = require('tweetnacl')
const base62 = require('base-x')('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
const KPoW = require('KPoW')

module.exports = class Block {
  constructor (type, data) {
    this.blockType = type
    this.hash = null
    this.timestamp = data?.timestamp ?? Date.now()
    this.previousHash = data.previousHash
    this.sender = data.sender
    this.recipient = data.recipient
    this.amount = data.amount
    this.nonce = data.nonce
    this.signature = data.signature

    this.hash = this.calculateHash()
  }

  calculateHash () {
    if (this.blockType === 'TRANSFER') {
      return crypto.createHash('ripemd160').update(this.blockType + this.previousHash + this.sender + this.recipient + this.amount).digest('hex')
    }
  }

  updateHash () {
    this.hash = this.calculateHash()
  }

  toData () {
    if (this.blockType === 'TRANSFER') {
      return { blockType: this.blockType, hash: this.calculateHash(), timestamp: this.timestamp, previousHash: this.previousHash, sender: this.sender, recipient: this.recipient, amount: this.amount.toString(), blockLink: this.blockLink, nonce: this.nonce, signature: this.signature }
    }
  }

  static importFromJSON (JSONBlock) {
    const block = new Block(JSONBlock)
    return block
  }

  linkBlock (hash) {
    this.blockLink = hash
  }

  updateNonce (nonce) {
    this.nonce = nonce
  }

  isValid () {
    return new Promise((resolve, reject) => {
      if (this.blockType === 'TRANSFER') {
        if (!this.sender.startsWith('kX') || !this.recipient.startsWith('kX')) return reject('WALLET_PREFIX')
        if (this.sender.length !== 48 || this.recipient.length !== 48) return reject('WALLET_LENGTH')
        if (this.calculateHash() !== this.hash) return reject('INVALID_HASH')
        if (this.sender === 'kX0000000000000000000000000000000000000000000000') return reject('BURN_ADDRESS')
        if (this.sender === this.recipient) return reject('SELF_SEND')

        if (!this.signature || this.signature.length === 0) {
          reject('NO_SIGNATURE')
        }

        if (!KPoW.checkWork(this.hash, this.nonce)) {
          reject('INVALID_WORK')
        }

        tweetnacl.sign.detached.verify(Uint8Array.from(Buffer.from(this.hash, 'hex')), Uint8Array.from(Buffer.from(this.signature, 'hex')), Uint8Array.from(base62.decode(this.sender.substring(1, 41)))).then(bool => {
          resolve(bool)
        })
      } else {
        reject('INVALID_BLOCKTYPE')
      }
    })
  }
}
