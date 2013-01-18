var net = require('net');
var reconnect = require('reconnect');

function connect(port, host, callback) {
  if (typeof host == 'function') {
    callback = host;
    host = undefined;
  }
  remote = reconnect();
  remote.connect(port, host);
  return remote;
}

function listen(port, host, callback) {
  if (typeof host == 'function') {
    callback = host;
    host = undefined;
  }
  var server = net.createServer();
  if (callback) server.once('listening', callback);
  server.listen(port, host);
  return server;
}

module.exports = {
  connect: connect,
  listen: listen
};