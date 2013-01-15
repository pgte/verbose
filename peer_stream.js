var duplexEmitter = require('duplex-emitter');
var reconnect = require('reconnect');
var Stream = require('stream');
var propagate = require('propagate');
var domain = require('domain');
var uuid = require('node-uuid');
var Messages = require('./messages');
var slice = Array.prototype.slice;

exports =
module.exports =
function PeerStream(options) {
  var s = new Stream();
  s.writable = true;
  s.readable = true;
  s.connectedTimes = 0;
  s.lastMessageId = undefined;

  var remoteReconnect;
  var remoteEmitter;
  var remoteStream;
  var messages = Messages({
    maxMessages: options.bufferMax,
    timeout:     options.bufferTimeout
  });
  var queue = [];
  var ended = false;
  var initialized = false;
  
  /// Queue

  function enqueue() {
    queue.push(slice.call(arguments));
  }

  function flush(err) {
    if (err) return s.emit('error', err);
    if (queue.length) {
      var action = queue[0];
      var method = action[0];
      var args = action.slice(1);
      
      // Drop this if stream is not active
      if ((ended || ! initialized) && (method == write)) {
        return;
      }

      // we're continuing with this queue item
      // remove it from the queue
      queue.splice(0, 1);

      // push in the callback function
      // as the last argument
      args.push(flush);

      // call the action method
      method.apply(this, args);
    } else {
      s.emit('drain');
    }
  }


  /// New Stream handler

  var handleStream =
  s.handleStream =
  function handleStream(_stream) {
    s.connectedTimes ++;

    remoteStream = _stream;

    // Create remote emitter
    remoteEmitter = duplexEmitter(remoteStream);

    // Do handshake
    handshake(function(err) {
      if (err) return s.emit('error', err);
      init();
      process.nextTick(flush);
    });

    // Domain and error handling
    var d = domain.create();
    d.add(_stream);
    d.on('error', function(err) {
      if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
        // The server was not there.
        // Let's just quit and let reconnect kick in
        _stream.end();
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

    remoteEmitter.emit('peerid', options.channel, options.node_id);
    var timeout = setTimeout(function() {
      done(new Error(
        'timeout waiting for channel handshake. Waited for ' + options.timeout + ' ms'));
    }, options.timeout);

    remoteEmitter.once('peerid', function(channel, remotePeerId) {

      if (channel != options.channel) {
        clearTimeout(timeout);
        return done(
          new Error(
            'wrong channel name: ' + channel + '. Expected ' + options.channel));
      }

      remoteEmitter.once('sync', function(lastMessageId, isReconnect) {
        clearTimeout(timeout);
        s.emit('initialized', remotePeerId);

        if (lastMessageId || isReconnect) resendSince(lastMessageId);

        initialized = true;
        done();
      });

      s.emit('peerid', remotePeerId);

      remoteEmitter.emit('sync', s.lastMessageId, s.connectedTimes > 1);

    });

    remoteEmitter.on('error', function(err) {
      s.emit('error', err);
    });

  }



  /// Messages

  s.takeMessages =
  function takeMessages(_messages) {
    messages = _messages;
  };

  s.pendingMessages =
  function pendingMessages() {
    return messages;
  };



  /// Resend since

  function resendSince(id) {
    var m;
    messages.acknowledge(id);
    while(m = messages.next()) {
      write(m.message, m.id, m.meta);
    }
  }
  

  /// On Remote Message

  function onRemoteMessage(msg, meta) {
    if (! meta || ! meta.nodes || ! meta.id) throw new Error('missing meta info in message');
    if (meta.nodes.indexOf(options.node_id) == -1) {
      meta.nodes.push(options.node_id);
      s.lastMessageId = meta.id;
      s.emit('data', msg);
    }
  }

  function onRemoteAcknowledge(id) {
    messages.acknowledge(id);
    s.emit('acknowledge', id);
  }


  /// Buffer length

  s.bufferLength =
  function bufferLength() {
    return messages.length();
  };

  /// Init

  function init() {
    remoteEmitter.on('message', onRemoteMessage);
    remoteEmitter.on('ack', onRemoteAcknowledge);
    
    // Send Acknowledge Interval
    function acknowledge() {
      if (s.lastMessageId) remoteEmitter.emit('ack', s.lastMessageId);
    }
    var ackInterval = setInterval(acknowledge, options.acknowledgeInterval);


    //  Acknowledge timeout
    var ackTimeout;
    function resetAcknowledgeTimeout() {
      if (ackTimeout) clearTimeout(ackTimeout);
      
      ackTimeout = setTimeout(function() {
        s.emit('timeout');
        if (remoteStream) remoteStream.destroy();
      }, options.timeout);
    }
    s.on('acknowledge', resetAcknowledgeTimeout);
    resetAcknowledgeTimeout();

    // Remove all listeners once the stream gets disconnected
    function cleanup() {
      initialized = false;
      remoteEmitter.removeListener('message', onRemoteMessage);
      remoteEmitter.removeListener('ack', onRemoteAcknowledge);
      s.removeListener('acknowledge', resetAcknowledgeTimeout);
      clearInterval(ackInterval);
      if (ackTimeout) clearTimeout(ackTimeout);
    }
    
    s.once('disconnect', cleanup);
    s.once('end', cleanup);
  }


  /// Write

  function write(msg, id, meta, done) {
    remoteEmitter.emit('message', msg, meta);
    if (done) done();
  };

  var enqueueWrite =
  s.write =
  function enqueueWrite(msg) {
    var id = uuid.v4();
    var meta = {
      id: id,
      nodes: [options.node_id]
    };
    messages.push(msg, id, meta);
    enqueue(write, msg, id, meta);
    process.nextTick(flush);
    return false;
  };


  /// End

  function end(done) {
    if (ended) return done();
    ended = true;
    s.writable = false;
    messages.end();
    s.disconnect();
    s.emit('end');
    if (done) done();
  }

  s.end =
  function enqueueEnd(msg) {
    if (msg) enqueueWrite(msg);
    enqueue(end);
    process.nextTick(flush);
    return false;
  };

  s.disconnect =
  function disconnect() {
    if (remoteReconnect) {
      remoteReconnect.reconnect = false;
      remoteReconnect.disconnect();
    }
  };

  s.destroy =
  function destroy() {
    s.disconnect();
    messages.end();
  };

  return s;
};