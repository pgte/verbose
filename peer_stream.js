var Stream = require('stream');
var propagate = require('propagate');
var domain = require('domain');
var uuid = require('node-uuid');
var Messages = require('./messages');
var slice = Array.prototype.slice;

exports =
module.exports =
function PeerStream(remoteStream, options, messageHub, lastMessageId, isReconnect) {
  var nodeId = options.node_id;

  var s = new Stream();
  s.writable = true;
  s.readable = true;
  s.connectedTimes = 0;
  s.lastMessageId = undefined;

  var remoteReconnect;
  var remoteEmitter;
  var peerId;
  var messages = Messages({
    maxMessages: options.bufferMax,
    timeout:     options.bufferTimeout
  });
  var ended = false;
  var initialized = false;


  // Domain and error handling
  var d = domain.create();
  d.add(remoteStream);
  d.on('error', function(err) {
    if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
      // The server was not there.
      // Let's just quit and let reconnect kick in
      remoteStream.end();
    } else s.emit('error', err);
  });


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
      proto.message(m.message, m.meta);
    }
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
      remoteEmitter.emit('ack', s.lastMessageId);
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
  

  /// On Message Hub Message

  function onMessageHubMessage(msg, meta) {
    if (ended) return;
    if (discardNextMessage) {
      discardNextMessage = false;
      return;
    }

    if (! meta) {
      meta = {
        id: uuid.v4(), // new message id
        nodes: []
      };
    }
    meta.nodes.push(nodeId);
    if (meta.nodes.indexOf(peerId) > -1) return;
    enqueueWrite(msg, meta, true);
  }
  
  s.once('initialized', function() {
    messageHub.on('message', onMessageHubMessage);
  });
  
  s.on('end', function() {
    messageHub.removeListener('message', onMessageHubMessage);
  });
  


  /// End

  function end(done) {
    if (ended) return done();
    ended = true;
    s.writable = false;
    messages.end();
    s.end();
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

  s.destroy =
  function destroy() {
    s.disconnect();
    messages.end();
  };


  /// Handle Stream

  //s.connectedTimes ++;

  var protocol = Protocol(remoteStream, options, lastMessageId, isReconnect);
  proto.initialize();
  
  proto.once('peerid', function(peerId) {
    s.emit('peerid', peerId);
  });
  
  proto.once('initialized', function(lastMessageId, isReconnect) {
    if (lastMessageId || isReconnect) resendSince(lastMessageId);
    s.emit('initialized');
  });

  // Do handshake
  handshake(function(err) {
    if (err) return s.emit('error', err);
    init();
    process.nextTick(flush);
  });



  return s;
};