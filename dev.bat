start cmd /k "nodemon index.js --port=2555 --tcpApi=2556 --debug=true"
start cmd /k "nodemon --delay 500ms index.js --port=2557 --tcpApi=2558 --P2P=localhost:2555 --debug=true"
start cmd /k "nodemon --delay 1000ms index.js --port=2559 --tcpApi=2560 --P2P=localhost:2557 --debug=true"
start cmd /k "nodemon --delay 1500ms index.js --port=2561 --tcpApi=2562 --P2P=localhost:2559 --debug=true"
