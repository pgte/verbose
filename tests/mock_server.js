var net = require('net');

module.exports =
function MockServer(options) {
  var server = net.createServer();
  server.bufs = '';
  var conns = [];
  
  server.on('connection', function(stream) {
    
    conns.push(stream);
    stream.on('data', function(d) {
      server.bufs += d.toString();
    });

    stream.write(
      '[\n' +
      '["channel","' + options.channel + '"]');
  });

  server.forceClose = function() {
    conns.forEach(function(conn) {
      conn.end();
    });
    server.close();
  }

  return server;
};