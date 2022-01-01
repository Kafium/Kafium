const http = require('http')
const events = require('events')

const Block = require('../ledger/Block')

module.exports = class RPCApi extends events.EventEmitter {
  constructor (kafium, port) {
    super()
    this.kafium = kafium

    this.listenRequests(port)
  }

  listenRequests (port) {
    http.createServer((req, res) => {

    if (req.method === "POST") {
      let receivedData = ""

      req.on("data", function (chunk) {
        receivedData += chunk
      })

      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" })

        try {
          const request = JSON.parse(receivedData)
          let returnedData

          if (request.method === "getBalance") {
            returnedData = this.kafium.getBalanceOfAddress(request.args[0]).toString()
          }

          if (request.method === "announceBlock") {
            const block = Block.importFromJSON(request.args[0])
            this.kafium.queueBlock(block)

            returnedData = block.hash
          }

          if (request.method === "getBlockByHash") {
            returnedData = this.kafium.getBlockByHash(request.args[0])
          }

          if (request.method === "getTotalBlocks") {
            returnedData = this.kafium.getTotalBlocks()
          }

          if (request.method === "queryChain") {
            returnedData = this.kafium.queryChain(request.args[0], request.args[1])
          }

          if (typeof returnedData === "undefined") return res.end(JSON.stringify({ "success": false, "error": "Invalid method" }))
          res.end(JSON.stringify({ "success": true, "result": returnedData }))
        } catch (err) { res.end(JSON.stringify({ "success": false, "error": err.stack.split('\n')[0] }) ) }
      })
    } else {
      res.end('wtf are u trying')
    }}).listen(port)
  }
}