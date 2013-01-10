var net = require('net');
var duplexEmitter = require('duplex-emitter');

module.exports =
function MockServer(options) {
  var server = net.createServer();
  server.bufs = '';
  server.messages = [];
  var conns = [];
  
  server.on('connection', function(stream) {
    conns.push(stream);
    stream.on('data', function(d) {
      server.bufs += d.toString();
    });

    var remoteEmitter = duplexEmitter(stream);
    remoteEmitter.emit('channel', options.channel);
    remoteEmitter.on('message', function(m) {
      server.messages.push(m);
    });

  });

  server.forceClose = function() {
    conns.forEach(function(conn) {
      conn.end();
    });
    conns = [];
    server.close();
  }

  return server;
};