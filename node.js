var EventEmitter = require('events').EventEmitter;
var server = require('./server');
var Options = require('./options');
var PeerStream = require('./peer_stream');
var Stream = require('stream');
var duplexer = require('duplexer');
var through = require('through');
var propagate = require('propagate');

exports =
module.exports =
function Node(options) {

  /// Exported stream

  function identity(data) {
    this.emit('data', data);
  }
  var inStream = through(identity);
  var outStream = through(identity);

  var s = duplexer(inStream, outStream); // exported stream
  
  /// Options
  
  options = Options(options);

  
  /// Logging
  
  var log = options.log;


  /// Wire up stream
  
  function wireup(stream) {
    stream.pipe(outStream);
    inStream.pipe(stream);

    // propagate some events
    var p = propagate(
      [
        'connect',
        'disconnect',
        'backoff',
        'reconnect',
        'initiated',
        'acknowledge'],
      stream,
      s);

    stream.once('end', function() {
      p.end(); // stop event propagation
      s.removeListener('end', onEnd);
    });

    // on end
    function onEnd() {
      stream.end();
    }

    s.on('_end', onEnd);
  }

  /// Connect

  s.connect =
  function connect(port, host, callback) {
    if (typeof host == 'function') {
      callback = host;
      host = undefined;
    }
    var peerStream = PeerStream(options);
    peerStream.connect(port, host, callback);
    wireup(peerStream);
    return peerStream;
  };


  /// Listen

  function handleServerConnection(stream) {
    var peerStream = PeerStream(options);
    peerStream.handleStream(stream);
    wireup(peerStream);
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

  s.end = function() {
    s.emit('_end');
  };

  return s;
};