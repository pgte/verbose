var net = require('net');
var duplexEmitter = require('duplex-emitter');

module.exports =
function MockServer(options) {
  var server = net.createServer();
  server.acknowledge = true;
  server.bufs = '';
  server.messages = [];
  server.metas = [];
  server.acknowledges = [];
  var conns = [];
  
  server.on('connection', function(stream) {
    conns.push(stream);
    stream.on('data', function(d) {
      server.bufs += d.toString();
    });

    var remoteEmitter =
    stream.remoteEmitter =
    duplexEmitter(stream);

    remoteEmitter.emit('peerid', options.channel, options.node_id);
    remoteEmitter.emit('sync', server.sync, false);
    
    remoteEmitter.on('message', function(m, meta) {
      if (server.acknowledge) remoteEmitter.emit('ack', meta.id);
      server.messages.push(m);
      server.metas.push(meta);
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