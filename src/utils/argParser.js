module.exports = function (processArgv, options = { }) {
  const args = {}
  processArgv.forEach(parseArgvs)

  function parseArgvs (value, index, array) {
    if (!value.startsWith(options.argIndicator ?? '--')) return
    const separated = value.split(options.argSeperator ?? '=')
    const argSetting = separated[0].replace('--', '')
    const argValue = separated[1]
    args[argSetting] = argValue
  }

  return args
}
