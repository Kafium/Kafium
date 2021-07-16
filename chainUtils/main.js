const { Blockchain, Block } = require('./blockchain')
const EC = require('elliptic').ec
const ec = new EC('p224')

const myKey = ec.keyFromPrivate('684cc6c9704d16e92d4ed497969c6c09a34f9f08bd75222f')

const myWalletAddress = myKey.getPublic('hex')

const Kafium = new Blockchain()

const transactionBlock = new Block(Kafium.getLatestBlock().hash, Date.now(), 'TRANSACTION', { sender: myWalletAddress, receiver: 'k#burn', amount: 100 })
transactionBlock.signTransaction(myKey)
console.log(myKey)

console.log(transactionBlock)
console.log(JSON.parse(transactionBlock.toData()))

Kafium.chain.push(transactionBlock)

console.log(`Balance of your is ${Kafium.getBalanceOfAddress(myWalletAddress)}`)

console.log('Blockchain valid?', Kafium.isChainValid() ? 'Yes' : 'No')
