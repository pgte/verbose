var EventEmitter = require('events').EventEmitter;
var server = require('./server');
var Options = require('./options');
var PeerStream = require('./peer_stream');
var PeerList = require('./peer_list');
var MessageHub = require('./message_hub');
var StreamEmitter = require('duplex-emitter/emitter');
var Stream = require('stream');
var duplexer = require('duplexer');
var through = require('through');
var propagate = require('propagate');

exports =
module.exports =
function Node(options) {

  // State
  var ending = false;
  var ended = false;

  /// Peer List
  var peerList = PeerList();

  /// Exported stream

  function identity(data) {
    this.emit('data', data);
  }
  var inStream = through(identity);
  var outStream = through(identity);

  var s = duplexer(inStream, outStream); // exported stream
  

  /// Options
  
  s.options =
  options =
  Options(options);


  // Message Hub
  var messageHub = MessageHub(options);

  
  /// Wire up stream
  
  function wireup(stream) {
    stream.pipe(outStream, {end: false});
    inStream.pipe(stream, {end: false});

    // propagate some events
    var p = propagate(
      [
        'connect',
        'disconnect',
        'backoff',
        'reconnect',
        'initialized',
        'acknowledge'],
      stream,
      s);

    stream.once('end', function() {

      // Destroy stream after timeout
      // if end was not intentional
      if (! ending) {
        var inactivityTimeout = setTimeout(function() {
          stream.destroy();
          removePeer(stream);
        }, options.bufferTimeout);

        // If stream is replaced by another stream
        // (which probably happened because of a reconnect)
        // we cancel the timeout
        // so that buffers don't get removed
        stream.once('_replaced', function() {
          clearTimeout(inactivityTimeout);
        });        
      } else {
        ended = true;
      }

      p.end(); // stop event propagation

      s.removeListener('_end', onEnd);
      s.removeListener('_disconnect', onDisconnect);
    });

    // on end
    function onEnd() {
      if (ended) return;
      ending = true;
      stream.end();
    }

    function onDisconnect() {
      stream.disconnect();
    }

    s.on('_end', onEnd);
    s.on('_disconnect', onDisconnect);
  }


  /// Add and Remove Peer

  function removePeer(peer) {
    if (peer.node_id) {
      peerList.remove(peer.node_id);
    }
  }

  function addPeer(peerId, peerStream) {
    var existingPeer = peerList.get(peerId);
    if (existingPeer) {
      peerStream.takeMessages(existingPeer.pendingMessages());
      peerStream.lastMessageId = existingPeer.lastMessageId;
      peerStream.connectedTimes += existingPeer.connectedTimes;
      existingPeer.emit('_replaced');
    }
    peerList.add(peerId, peerStream);
  }

  s.peers =
  function peers() {
    return peerList.all();
  };


  /// Connect

  s.connect =
  function connect(port, host, callback) {
    if (ending || ended) throw new Error('Ended');
    if (typeof host == 'function') {
      callback = host;
      host = undefined;
    }
    var peerStream = PeerStream(options, messageHub);
    peerStream.once('peerid', function(peerId) {
      addPeer(peerId, peerStream);
    });
    peerStream.connect(port, host, callback);
    wireup(peerStream);
    return peerStream;
  };


  /// Listen

  function handleServerConnection(stream) {
    var peerStream = PeerStream(options, messageHub);
    peerStream.once('peerid', function(peerId) {
      peerStream.node_id = peerId;
      addPeer(peerId, peerStream);
    });
    wireup(peerStream);
    peerStream.handleStream(stream);
    
    stream.on('end', function() {
      peerStream.emit('end');
    });
  }

  s.listen =
  function listen(port, host, callback) {
    if (typeof host == 'function') {
      callback = host;
      host = undefined;
    }

    var ss = server.create();
    ss.removeListener('connection', handleServerConnection);
    ss.on('connection', handleServerConnection);
    if (callback) ss.once('listening', callback);
    ss.listen(port, host);
    ss.once('listening', function() {
      s.emit('listening', port, host);
    });
    
    s.on('_end', function() {
      ss.removeListener('connection', handleServerConnection);
      try {
        ss.close();
      } catch(err) {
        console.error(err);
      }
    });
  };


  /// End

  function end() {
    s.emit('_end');
  };
  s.end = end;

  s.disconnect =
  function disconnect() {
    s.emit('_disconnect');
  };


  /// Emitter

  var emitter;
  s.emitter = 
  function () {
    if (! emitter) {
      emitter = StreamEmitter(s);
      emitter.end = end;
    }
    return emitter;
  }
  
  return s;
};