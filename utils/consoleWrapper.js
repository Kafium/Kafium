const readline = require('readline')
const prompt = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

prompt.setPrompt('$ ')
prompt.prompt(true)

const log = message => {
  const date = new Date()
  const today = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).split(' ').join('-')
  const timeString = date.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, '$1')
  console.log(`\x1b[33m${today} ${timeString}\x1b[0m [\x1b[32mLOG\x1b[0m]: ${message}`)
}

console.log = (function () {
  const orig = console.log
  return function () {
    readline.cursorTo(process.stdout, 0)
    let tmp
    try {
      tmp = process.stdout
      process.stdout = process.stderr
      orig.apply(console, arguments)
    } finally {
      process.stdout = tmp
    }
    prompt.prompt(true)
  }
})()

module.exports = { log, prompt }
