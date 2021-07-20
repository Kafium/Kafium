function uint8ToHex (uint8) {
  var hex = "";
  let aux;
  for (let i = 0; i < uint8.length; i++) {
    aux = uint8[i].toString(16).toLowerCase();
    if (aux.length == 1)
      aux = '0' + aux;
    hex += aux;
    aux = '';
  }
  return (hex);
}

function hexToUint8 (hex) {
  var length = (hex.length / 2) | 0;
  var uint8 = new Uint8Array(length);
  for (let i = 0; i < length; i++) uint8[i] = parseInt(hex.substr(i * 2, 2), 16);
  return uint8;
}

module.exports = { hexToUint8, uint8ToHex}