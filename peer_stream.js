var Stream = require('stream');
var propagate = require('propagate');
var domain = require('domain');
var uuid = require('node-uuid');

var Options = require('./options');
var Messages = require('./messages');
var Protocol = require('./peer_protocol');


exports =
module.exports =
function PeerStream(remoteStream, opts) {
  var options = Options(opts);
  
  var nodeId = options.node_id;

  var s = new Stream();
  s.writable = true;
  s.readable = true;

  /// Domain and error handling

    var d = domain.create();
    d.add(remoteStream);
    d.on('error', function(err) {
      if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
        // The server was not there.
        // Let's just quit and let reconnect kick in
        remoteStream.end();
      } else s.emit('error', err);
    });

  
  /// Messages Buffer

    var messages = Messages({
      maxMessages: options.bufferMax,
      timeout:     options.bufferTimeout
    });

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
        protocol.message(m.message, m.meta);
      }
    }

    /// Buffer length
    s.bufferLength =
    function bufferLength() {
      return messages.length();
    };



  /// Protocol

    var protocol = Protocol(remoteStream, options, s.lastMessageId, s.isReconnect);
    
    function onError(err) {
      s.emit('error', err);
    }

    protocol.on('error', onError);

    protocol.once('peerid', function(peerId) {
      s.emit('peerid', peerId);
    });
    
    protocol.once('initialized', function(lastMessageId, isReconnect) {
      if (lastMessageId || isReconnect) resendSince(lastMessageId);
      s.emit('initialized');
    });

    function onRemoteMessage(msg, meta) {
      s.emit('data', msg);
      s.lastMessageId = meta.id;
    }

    function onRemoteAcknowledge(id) {
      messages.acknowledge(id);
      resetAcknowledgeTimeout();
      s.emit('acknowledge', id);
    }

    protocol.on('message', onRemoteMessage);
    protocol.on('acknowledge', onRemoteAcknowledge);

    // Propagate some events from the protocol into the stream
    propagate(['drain'], protocol, s);

    function acknowledge() {
      if (s.lastMessageId) protocol.acknowledge(s.lastMessageId);
    }
    var ackInterval = setInterval(acknowledge, options.acknowledgeInterval);

    var ackTimeout;
    function resetAcknowledgeTimeout() {
      if (ackTimeout) clearTimeout(ackTimeout);
      
      ackTimeout = setTimeout(function() {
        s.emit('timeout');
        if (remoteStream) remoteStream.destroy();
      }, options.timeout);
    }

    protocol.once('end', function() {
      protocol.removeListener('error', onError);
      protocol.removeListener('message', onRemoteMessage);
      protocol.removeListener('acknowledge', onRemoteAcknowledge);
      clearInterval(ackInterval);
      if (ackTimeout) clearTimeout(ackTimeout);
      ackTimeout = undefined;
      messages.end();
      s.emit('end');
    });


  /// Write

  s.write =
  function write(d, meta) {

    if (! meta) {
      meta = {
        id: uuid.v4(), // new message id
        nodes: []
      };
    }

    messages.push(d, meta.id, meta);
    return protocol.message(d, meta);
  };

  /// End

  s.end =
  function enqueueEnd(msg) {
    protocol.end();
  };

  protocol.initialize();

  return s;
};