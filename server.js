var net = require('net');
var server;

function create(port, host) {
  if (! server) {
    server = net.createServer();
  }
  return server;
}

module.exports = {
  create: create
};