var Stream = require('stream');
var InvertStream = require('invert-stream');
var propagate = require('propagate');

var PeerStream = require('./peer_stream');

module.exports =
function BufferedPeer(options, stream) {

  var buffer = [];
  var peerStream;
  var recon;

  var s = InvertStream();


  /// Handle new connections

  function handleConnection(stream) {
    var oldPeerStream = peerStream;
    peerStream = PeerStream(stream, options);
    
    /// If there is an old peer, let's hand-off the pending messages
    if (oldPeerStream) {
      peerStream.takeMessages(oldPeerStream.pendingMessages());
    }

    peerStream.pipe(s.other, {end: false});

    buffer.forEach(function(m) {
      peerStream.write(m);
    });
    buffer = [];

    propagate([
      'connect',
      'disconnect',
      'backoff',
      'reconnect',
      'initialized',
      'acknowledge'],
      peerStream, s);

    /// Hand-off all the errors from stream
    peerStream.on('error', function(err) {
      s.emit('error', err);
    });
  }


  /// Connect

  s.connect =
  function connect(opts, callback) {
    recon = options.transport.connect(opts, handleConnection, callback);
  };
  

  /// Disconnect

  s.disconnect =
  function disconnect() {
    console.log('disconnecting...');
    if (recon) recon.reconnect = false;
    if (peerStream) {
      peerStream.once('end', function() {
        s.emit('end');
      });
      peerStream.end();
    } else {
      s.emit('end');
    }
  };


  /// Write

  s.write =
  function write(b) {
    if (! peerStream) {
      buffer.push(b);
      return true;
    } else {
      return peerStream.write(b);
    }
  };


  /// Already connected?

  if (stream) handleConnection(stream);

  return s;
};