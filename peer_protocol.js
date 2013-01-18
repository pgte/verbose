var DuplexEmitter = require('duplex-emitter');
var EventEmitter = require('events').EventEmitter;
var uuid = require('node-uuid');
var slice = Array.prototype.slice;

exports =
module.exports =
function PeerProtocol(remoteStream, options, lastMessageId, isReconnect) {

  var nodeId = options.node_id;

  /// Returned emitter
  var e = new EventEmitter();
  
  /// Protocol State
  var initialized = false;
  var ended = false;
  var peerId;

  /// Make duplex emitter from raw stream
  var remoteEmitter = DuplexEmitter(remoteStream);


  /// Command Queue

  var queue = [];
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
      if ((ended || ! initialized) && (method == message)) return;

      // we're continuing with this queue item
      // remove it from the queue
      queue.splice(0, 1);

      // push in the callback function
      // as the last argument
      args.push(flush);

      // call the action method
      method.apply(this, args);
    } else {
      e.emit('drain');
    }
  }


  /// Initialize

  e.initialize =
  function initialize() {
    if (initialized) throw new Error('Already initialized');
    if (ended)  throw new Error('Ended');

    remoteEmitter.emit('peerid', options.channel, nodeId);
    var timeout = setTimeout(function() {
      e.emit('error', new Error(
        'timeout waiting for channel handshake. Waited for ' + options.timeout + ' ms'));
      e.end();
    }, options.timeout);

    remoteEmitter.once('peerid', function(channel, remotePeerId) {
      peerId = remotePeerId;
      if (channel != options.channel) {
        clearTimeout(timeout);
        return e.emit('error',
          new Error(
            'wrong channel name: ' + channel + '. Expected ' + options.channel));
      }

      remoteEmitter.once('sync', function(lastMessageId, isReconnect) {
        clearTimeout(timeout);
        e.emit('initialized', lastMessageId, isReconnect);

        initialized = true;

        process.nextTick(flush);

      });

      e.emit('peerid', remotePeerId);

      remoteEmitter.emit('sync', lastMessageId, isReconnect);

    });

    remoteEmitter.on('error', function(err) {
      s.emit('error', err);
    });    
  }


  /// On Remote Message

  function onRemoteMessage(msg, meta) {
    if (! initialized) throw new Error('Not initialized');
    if (! meta || ! meta.nodes || ! meta.id) throw new Error('missing meta info in message');
    if (meta.nodes.indexOf(nodeId) == -1) {
      meta.nodes.push(nodeId);
      s.emit('message', msg, meta);
    }
  }

  /// On Remote Acknowledge

  function onRemoteAcknowledge(id) {
    s.emit('acknowledge', id);
  }


  /// Send Message

  function message(msg, meta, done) {
    console.log('sending out message', msg);
    remoteEmitter.emit('message', msg, meta);
    if (done) done();
  };

  e.message =
  function enqueueMessage(msg, meta, dontHub) {
    if (ended) throw new Error('Ended');
    if (! meta) {
      meta = {
        id: uuid.v4(), // new message id
        nodes: []
      };
    }
    if (meta.nodes.indexOf(peerId) > -1) return;

    enqueue(message, msg, meta);
    process.nextTick(flush);
    return false;
  };


  /// End
  e.end =
  function end() {
    if (ended) return;
    remoteStream.end();
    e.emit('end');
  };


  /// Listeners

  remoteEmitter.on('message', onRemoteMessage);
  remoteEmitter.on('ack', onRemoteAcknowledge);

  remoteStream.once('end', function() {
    ended = true;
    remoteEmitter.removeListener('message', onRemoteMessage);
    remoteEmitter.removeListener('ack', onRemoteAcknowledge);
  });


  return e;
};