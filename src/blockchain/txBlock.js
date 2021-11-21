const crypto = require('crypto')
const curve = require('noble-ed25519')

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
      if (!this.sender.startsWith('kX') || !this.receiver.startsWith('kX')) return reject('invalid_wallet')
      if (this.sender === this.receiver) return reject('self_send')

      if (!this.signature || this.signature.length === 0) {
        reject('NO_SIGNATURE')
      }

      curve.verify(this.signature, this.calculateHash(), Buffer.from(this.sender.replace('kX', '').slice(0, -4), 'base64').toString()).then(bool => {
        resolve(bool)
      })
    })
  }
}

module.exports = { txBlock }