const crypto = require('crypto')
const kcrypto = require('kcrypto')

class txBlock {
  constructor (data) {
    this.txType = data.txType
    this.timestamp = data.timestamp
    this.previousHash = data.previousHash
    this.sender = data.sender
    this.receiver = data.receiver
    this.amount = data.amount
    
    this.hash = this.calculateHash()
  }

  calculateHash () {
    return crypto.createHash('ripemd160').update(this.txType + this.timestamp + this.previousHash + this.sender + this.receiver + this.amount).digest('hex')
  }

  toSqlData () {
    return { hash: this.calculateHash(), txType: this.txType, timestamp: this.timestamp, previousHash: this.previousHash, sender: this.sender, receiver: this.receiver, amount: this.amount, signature: this.signature }
  }

  toData () {
    return `{
  "hash": "${this.hash}",
  "txType": "${this.txType}",
  "timestamp": ${this.timestamp},
  "previousHash": "${this.previousHash}",
  "sender": "${this.sender}",
  "receiver": "${this.receiver}",
  "amount": ${this.amount},
  "signature": "${this.signature}"
}`
  }

  static importFromJSON (JSONBlock) {
    const block = new Block({ txType: JSONBlock.txType, timestamp: JSONBlock.timestamp, previousHash: JSONBlock.previousHash, sender: JSONBlock.sender, receiver: JSONBlock.receiver, amount: JSONBlock.amount })
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

      kcrypto.ed25519.verify(this.signature, this.calculateHash(), Buffer.from(this.sender.replace('kX', '').slice(0, -4), 'base64').toString()).then(bool => {
        resolve(bool)
      })
    })
  }
}

module.exports = { txBlock }