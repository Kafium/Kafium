const crypto = require('crypto')

const tweetnacl = require('tweetnacl')
const base62 = require('base-x')('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
const CRC8 = require('CRC8')
const KPoW = require('KPoW')

module.exports = class Block {
  constructor (type, data) {
    this.blockType = type
    this.hash = null
    this.timestamp = data?.timestamp ?? Date.now()
    this.previousBlock = data?.previousBlock ?? null
    this.sender = data.sender
    this.recipient = data.recipient
    this.amount = data.amount
    this.work = data.work
    this.signature = data.signature

    this.hash = this.calculateHash()
  }

  calculateHash () {
    if (this.blockType === 'TRANSFER') {
      return crypto.createHash('ripemd160').update(this.blockType + this.previousBlock + this.sender + this.recipient + this.amount).digest('hex')
    }
  }

  updateHash () {
    this.hash = this.calculateHash()
  }

  toData () {
    if (this.blockType === 'TRANSFER') {
      return { blockType: this.blockType, hash: this.calculateHash(), timestamp: this.timestamp, previousBlock: this.previousBlock, sender: this.sender, recipient: this.recipient, amount: this.amount.toString(), blockLink: this.blockLink, work: this.work, signature: this.signature }
    }
  }

  static importFromJSON (JSONBlock) {
    const block = new Block(JSONBlock.blockType, JSONBlock)
    return block
  }

  linkBlock (hash) {
    this.blockLink = hash
  }

  updateWork (work) {
    this.work = work
  }

  isValid () {
    return new Promise((resolve, reject) => {
      if (this.blockType === 'TRANSFER') {
        if (!(this.sender.startsWith('kX') && this.recipient.startsWith('kX'))) return reject('invalid_prefix')
        if (!(this.sender.length === 47 && this.recipient.length === 47)) return reject('invalid_size')
        if (!CRC8(this.sender.substring(2, 45)) === this.sender.slice(-2) || !CRC8(this.recipient.substring(2, 45)) === this.recipient.slice(-2)) return reject('invalid_checksum')
        if (this.calculateHash() !== this.hash) return reject('invalid_hash')
        if (this.sender === 'kX00000000000000000000000000000000000000000000a9') return reject('invalid_wallet')
        if (this.sender === this.recipient) return reject('invalid_tx')

        if (!this.signature || this.signature.length === 0) {
          reject('invalid_signature')
        }

        if (!KPoW.checkWork(this.hash, this.work)) {
          reject('invalid_work')
        }

        const message = tweetnacl.sign.open(Uint8Array.from(Buffer.from(this.signature, 'hex')), Uint8Array.from(base62.decode(this.sender.substring(2, 45))))
        resolve(this.hash === Buffer.from(message).toString('hex'))
      } else {
        reject('invalid_blocktype')
      }
    })
  }
}
