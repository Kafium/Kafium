function waitForData (socket, waitingData) {
  return new Promise((resolve, reject) => {
    socket.on('data', listener)

    function listener (data) {
      if (data.toString().includes(waitingData)) {
        resolve(data)
        socket.removeListener('data', listener)
      }
    }

    wait(5000).then(() => {
      reject('TIMEOUT')
      socket.removeListener('data', listener)
    })
  })
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = { waitForData, wait }
