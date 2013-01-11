var net = require('net');
var duplexEmitter = require('duplex-emitter');

module.exports =
function MockServer(options) {
  var server = net.createServer();
  server.bufs = '';
  server.messages = [];
  server.acknowledges = [];
  var conns = [];
  
  server.on('connection', function(stream) {
    conns.push(stream);
    stream.on('data', function(d) {
      server.bufs += d.toString();
    });

    var remoteEmitter = duplexEmitter(stream);
    remoteEmitter.emit('channel', options.channel);
    
    remoteEmitter.on('message', function(m, meta) {
      remoteEmitter.emit('ack', meta.id);
      server.messages.push(m);
    });

    remoteEmitter.on('ack', function(id) {
      server.acknowledges.push(id);
    });

    if (server.send) {
      server.send.forEach(function(msg) {
        var args = msg;
        args.unshift('message');
        remoteEmitter.emit.apply(remoteEmitter, args);
      });
    }

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