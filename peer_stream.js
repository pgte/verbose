var duplexEmitter = require('duplex-emitter');
var reconnect = require('reconnect');
var Stream = require('stream');
var propagate = require('propagate');
var domain = require('domain');
var slice = Array.prototype.slice;

exports =
module.exports =
function PeerStream(options) {
  var log = options.log || function() {};
  
  var s = new Stream();
  s.writable = true;
  s.readable = true;

  var remoteReconnect;
  var remoteEmitter;
  var remoteStream;
  var queue = [];
  var ended = false;
  var initiated = false;


  /// Queue

  function enqueue() {
    var args = slice.call(arguments);
    if (args.length == 1) args.push([]);
    queue.push(args);
  }

  function flush(err) {
    if (err) return s.emit('error', err);
    if (queue.length) {
      var action = queue[0];
      var method = action[0];
      var args = action[1];
      
      // Drop this if stream is not active
      if (method == write && (ended || ! initiated)) {
        return;
      }

      if (! Array.isArray(args)) args = [args];
      queue.splice(0, 1);
      args.push(flush); // callback function
      method.apply(this, args);
    } else {
      s.emit('drain');
    }
  }


  /// New Stream handler

  var handleStream =
  s.handleStream =
  function handleStream(_stream) {

    remoteStream = _stream;

    // Create remote emitter
    remoteEmitter = duplexEmitter(remoteStream);

    // Do handshake
    console.log('about to do handshake');
    handshake(function(err) {
      if (err) return s.emit('error', err);
      init();
      process.nextTick(flush);
    });

    // Domain and error handling
    var d = domain.create();
    d.add(_stream);
    d.on('error', function(err) {
      if (err.code === 'EPIPE') {
        // The server was not there.
        // Let's just quit and let reconnect kick in
        _stream.destroy();
      } else s.emit('error', err);
    });
  }


  /// Connect
  
  s.connect =
  function connect(port, host, callback) {
    remoteReconnect = reconnect(handleStream).connect(port, host);
    propagate(remoteReconnect, s);
    if (callback) remoteReconnect.once('connect', callback);
    return s;
  };


  /// Handshake

  function handshake(done) {
    var timeout = setTimeout(function() {
      done(new Error(
        'timeout waiting for channel handshake. Waited for ' + options.timeout + ' ms'));
    }, options.timeout);

    remoteEmitter.once('channel', function(channel) {
      clearTimeout(timeout);
      if (channel != options.channel) {
        return done(
          new Error(
            'wrong channel name: ' + channel + '. Expected ' + options.channel));
      }
      s.emit('initiated');
      initiated = true;
      done();
    });

    remoteEmitter.on('error', function(err) {
      s.emit('error', err);
    });

    remoteEmitter.emit('channel', options.channel);
  }


  /// Init

  function init() {
    function onRemoteMessage(msg, meta) {
      if (! meta) meta = { nodes: [] };
      if (meta.nodes.indexOf(options.node_id) == -1) {
        meta.nodes.push(options.node_id);
        s.emit('data', msg);
      }
    }
    remoteEmitter.on('message', onRemoteMessage);
    
    // Remove all listeners once the stream gets disconnected
    s.once('disconnect', function() {
      initiated = false;
      remoteEmitter.removeListener('message', onRemoteMessage);
    });
  }


  /// Write

  function write(msg, done) {
    var meta = {
      nodes: [options.node_id]
    };
    remoteEmitter.emit('message', msg, meta);
    done();
  };

  var enqueueWrite =
  s.write =
  function enqueueWrite(msg) {
    enqueue(write, msg);
    process.nextTick(flush);
    return false;
  };


  /// End

  function end(done) {
    if (ended) return done();
    ended = true;
    s.writable = false;
    if (remoteReconnect) {
      remoteReconnect.reconnect = false;
      remoteReconnect.disconnect();
    }
    if (done) done();
  }

  s.end =
  function enqueueEnd(msg) {
    if (msg) enqueueWrite(msg);
    enqueue(end);
    process.nextTick(flush);
    return false;
  };

  s.destroy = end.bind(s);


  return s;
};