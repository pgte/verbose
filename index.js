var reconnect = require('reconnect');
var duplexEmitter = require('duplex-emitter');
var uuid = require('node-uuid');
var EventEmitter = require('events').EventEmitter;
var server = require('./server');

var slice = Array.prototype.slice;

function RemoteChannel(options) {
  var isServer = false;
  var retEmitter = new EventEmitter();
  var emitter = new EventEmitter();
  var established = false;
  var messages = [];

  if (! options) options = {};
  if (typeof options == 'string') {
    var channelName = options;
    options = {
      channel: channelName
    };
  }
  if (! options.channel) throw new Error('No channel name');

  if (! options.node_id) options.node_id = uuid.v4();

  /// Channel establishment

  function handleConnection(stream) {
    var emitter = duplexEmitter(stream);
    emitter.emit('channel', options.channel, options.node_id);
    establishChannel(stream, emitter);
  }

  
  /// Establish Channel

  function establishChannel(stream, remoteEmitter) {

    established = true;
    
    emitter.on('message', function(msg, meta) {
      if (meta.nodes.indexOf(remoteEmitter.node_id) == -1) {
        remoteEmitter.emit('message', msg, meta);
      }
    });
    
    remoteEmitter.on('message', function(msg, meta) {
      if (meta.nodes.indexOf(options.node_id) == -1) {
        meta.nodes.push(options.node_id);
        emitter.emit('message', msg, meta);
        retEmitter.emit('message', msg);
      }
    });

    flush();
  
  }


  /// Message

  function flush() {
    if (! established) return;
    while (messages.length) {
      var message = messages.splice(0, 1)[0];
      emitter.emit('message', message[0], message[1]);
    }
  }

  function connect(port, host, callback) {
    var calledback = false;

    if (arguments.length < 3) {
      if (typeof host == 'function') {
        callback = host;
        host = undefined;
      }
    }

    var recon = reconnect(handleConnection).connect(port, host);
    recon.on('connect', function(stream) {
      if (! calledback && callback) {
        calledback = true;
        callback();
      }
    });
    
    emitter.once('end', function() {
      recon.reconnect = false;
      recon.disconnect();
    });
  }

  function listen(port, host, callback) {
    isServer = true;
    if (typeof host == 'function') {
      callback = host;
      host = undefined;
    }
    var s = server.create().listen(port, host);
    if (! s._users) s._users = 0;
    s._users ++;

    if (callback) s.on('listening', callback);
    s.on('connection', function(stream) {
      var emitter = duplexEmitter(stream);
      emitter.once('channel', function(channelName, node_id) {
        if (channelName == options.channel) {
          emitter.node_id = node_id;
          establishChannel(stream, emitter);
        }
      });
    });

    emitter.once('end', function() {
      if (-- s._users == 0) {
        s.close();
      }
    });
  }


  /// Send a message

  function sendMessage(msg) {

    // Signify that we already crossed this node
    var meta = {
      nodes: [options.node_id]
    };

    messages.push([msg, meta]);

    flush();
  }

  function handleMessage(msg) {
    ee.emit('message', msg);
  }

  
  /// End

  function end() {
    emitter.emit('end');
  }

  retEmitter.connect = connect;
  retEmitter.listen = listen;
  retEmitter.message = sendMessage;
  retEmitter.end = end;

  return retEmitter;
}

module.exports = RemoteChannel;