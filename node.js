var EventEmitter = require('events').EventEmitter;
var server = require('./server');
var Options = require('./options');
var PeerStream = require('./peer_stream');
var PeerList = require('./peer_list');
var Stream = require('stream');
var duplexer = require('duplexer');
var through = require('through');
var propagate = require('propagate');

exports =
module.exports =
function Node(options) {

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

  
  /// Logging
  
  var log = options.log;


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
      p.end(); // stop event propagation
      s.removeListener('_end', onEnd);
      s.removeListener('_disconnect', onDisconnect);
      s.emit('end');
    });

    // on end
    function onEnd() {
      stream.end();
    }

    function onDisconnect() {
      stream.disconnect();
    }

    s.on('_end', onEnd);
    s.on('_disconnect', onDisconnect);
  }

  
  /// Add Peer

  function addPeer(peerId, peerStream) {
    var existingPeer = peerList.get(peerId);
    if (existingPeer) {
      peerStream.takeMessages(existingPeer.pendingMessages());
      peerStream.lastMessageId = existingPeer.lastMessageId;
      peerStream.connectedTimes += existingPeer.connectedTimes;
    }
    peerList.add(peerId, peerStream);
  }

  /// Connect

  s.connect =
  function connect(port, host, callback) {
    if (typeof host == 'function') {
      callback = host;
      host = undefined;
    }
    var peerStream = PeerStream(options);
    peerStream.once('peerid', function(peerId) {
      addPeer(peerId, peerStream);
    });
    peerStream.connect(port, host, callback);
    wireup(peerStream);
    return peerStream;
  };


  /// Listen

  function handleServerConnection(stream) {
    var peerStream = PeerStream(options);
    peerStream.once('peerid', function(peerId) {
      addPeer(peerId, peerStream);
    });
    wireup(peerStream);
    peerStream.handleStream(stream);
  }

  s.listen =
  function listen(port, host, callback) {
    if (typeof host == 'function') {
      callback = host;
      host = undefined;
    }

    var ss = server.create();
    ss.incrementUsers();
    ss.removeListener('connection', handleServerConnection);
    ss.on('connection', handleServerConnection);
    if (callback) ss.once('listening', callback);
    ss.listen(port, host);
    
    s.on('_end', function() {
      ss.removeListener('connection', handleServerConnection);
      ss.decrementUsersAndClose();
    });
  };

  s.end =
  function() {
    s.emit('_end');
  };

  s.disconnect =
  function() {
    s.emit('_disconnect');
  };

  return s;
};