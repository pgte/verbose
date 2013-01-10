var EventEmitter = require('events').EventEmitter;
var server = require('./server');
var Options = require('./options');
var PeerStream = require('./peer_stream');
var Stream = require('stream');
var duplexer = require('duplexer');
var through = require('through');

exports =
module.exports =
function Node(options) {

  /// Exported stream

  function identity(data) {
    this.emit('data', data);
  }
  var inStream = through(identity);
  var outStream = through(identity);

  var s = duplexer(inStream, outStream);
  
  /// Options
  
  options = Options(options);

  
  /// Logging
  
  var log = options.log;


  /// Wire up stream
  
  function wireup(stream) {
    stream.pipe(outStream);
    inStream.pipe(stream);

    function onEnd() {
      console.log('onEnd');
      stream.end();
    }
    s.on('end', onEnd);
    stream.on('end', function() {
      s.removeListener('end', onEnd);
    });
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
    var ss = server.create(port, host);
    ss.incrementUsers();
    ss.removeListener('connection', handleServerConnection);
    ss.on('connection', handleServerConnection);
    ss.listen(port, host, callback);
    
    s.on('end', function() {
      ss.decrementUsersAndClose();
    });
  };

  s.end = function() {
    s.emit('end');
  };

  return s;
};