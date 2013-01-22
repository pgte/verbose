var EventEmitter = require('events').EventEmitter;
var StreamEmitter = require('duplex-emitter/emitter');
var InvertStream = require('invert-stream');
var propagate = require('propagate');

var server = require('./server');
var Options = require('./options');
var PeerStream = require('./peer_stream');
var PeerPool = require('./peer_pool');
var MessageHub = require('./message_hub');
var Transport = require('./transport');

exports =
module.exports =
function Node(options) {

  /// Options
  options =
  Options(options);

  // State
  var ending = false;
  var ended = false;

  /// Exported stream
  var s = InvertStream();

  /// Internal spine duplex stream to pipe to and from peers
  var spine = s.other;

  /// Peer Pool
  var peers = PeerPool(spine, options);

  /// Emitter
  var e = StreamEmitter(s);
  e.stream = s;

  /// Internal Commands Emitter
  var commands = new EventEmitter();

  // Message Hub
  var messageHub = MessageHub(options);

  e.peers =
  function peers() {
    return peers.list();
    return e;
  };


  /// Handle Connection

  function handleConnection(stream) {
    var peer = PeerStream(stream, options);

    /// Propagate some events from peer into the stream
    var p = propagate(
      [
        'initialized',
        'acknowledge'],
      peer,
      s);
    
    /// Once we get a peer identification,
    ///   we add this stream to the peer pool
    peer.once('peerid', function(peerId) {
      peers.add(peerId, peer);
    });

    /// End the stream on "end" command
    function ender() {
      if (! peer.ended) peer.end();
    }

    commands.on('end', ender);

    /// Remove end command listener if the stream ends before the command
    peer.once('end', function() {
      commands.removeListener('end', ender);
    });
  }


  /// Connect

  e.connect =
  function connect(opts, callback) {
    if (ending || ended) throw new Error('Ended');
    if (typeof host == 'function') {
      callback = host;
      host = undefined;
    }

    var recon = options.transport.connect(opts, handleConnection, callback);
    
    propagate([
      'connect',
      'disconnect',
      'backoff',
      'reconnect'],
      recon,
      s);

    commands.once('end', function() {
      console.log('disconnecting permanently');
      recon.reconnect = false;
      recon.disconnect();
    })

    return e;
  }; 


  /// Listen

  e.listen =
  function listen(port, host, callback) {
    if (ending || ended) throw new Error('Ended');
    if (typeof host == 'function') {
      callback = host;
      host = undefined;
    }

    var server = options.transport.listen(port, host, callback);
    server.on('connection', handleConnection);
    server.once('listening', function() {
      s.emit('listening', port, host);
    });
    
    commands.on('end', function() {
      server.removeListener('connection', handleConnection);
      try {
        server.close();
      } catch(err) {
        console.error(err);
      }
    });

    return e;
  };


  /// End

  function end() {
    commands.emit('end');
    peers.end();
    return e;
  };
  e.end = end;

  e.disconnect =
  function disconnect() {
    commands.emit('disconnect');
    return e;
  };

  return e;
};