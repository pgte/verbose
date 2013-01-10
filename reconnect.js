var reconnect = require('reconnect');
var PeerStream = require('./peer_stream');
var EventEmitter = require('events').EventEmitter;
var propagate = require('propagate');

// Returns a reconnecting peer
function Reconnect(port, host, options, channel, callback) {
  var peer = new EventEmitter();
  
  var recon = reconnect(function(stream) {
    
    peer.stream = stream;
    var s = PeerStream(stream, options, channel);
  
    s.init(function(err) {
      if (err) {
        // we got an error
        // let's try and reconnect
        console.error(err);
        s.end();
        return;
      }
      peer.emit('initiated');
    });

    if (callback) recon.once('connect', callback);
    
    channel.once('end', function() {
      recon.reconnect = false;
      recon.disconnect();
    });

  });
  
  if (callback) recon.once('connect', callback);
  
  recon.listen(port, host);

  propagate([
    'connect',
    'disconnect',
    'backoff',
    'reconnect'
  ], recon, peer);

  return peer;
}

module.exports = Reconnect;