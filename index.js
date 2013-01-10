'use strict';

require('colors');
var EventEmitter = require('events').EventEmitter;
var server = require('./server');
var Options = require('./options');
var Reconnect = require('./reconnect');
var PeerStream = require('./peer_stream');

function RemoteChannel(options) {
  /// Closure vars
  
  var isServer = false;
  var publicEmitter = new EventEmitter();
  var channel = new EventEmitter();
  var messages = [];

  
  // Options
  
  options = Options(options);

  
  /// Logging
  
  var log = options.log;

  
  /// Connect

  function connect(port, host, callback) {
    log('connect');
    var calledback = false;

    if (arguments.length < 3) {
      if (typeof host === 'function') {
        callback = host;
        host = undefined;
      }
    }

    var timeout = setTimeout(function() {
      var error = new Error('Timeout connecting to host ' + host + ', port ' + port);
      if (callback)
        return callback(error);
      else publicEmitter.emit('error', error);
    }, options.timeout);

    var peer = Reconnect(port, host, options, channel);
    peer.on('initiated', function() {
      log('initiated');
      clearTimeout(timeout);
      if (callback) return callback;
    });

  }


  /// Listen

  function listen(port, host, callback) {
    isServer = true;
    log('listen');
    if (typeof host === 'function') {
      callback = host;
      host = undefined;
    }
    var s = server.create()
    s.listen(port, host);
    s.incrementUsers();

    s.on('connection', function(stream) {
      log('server connection');
      var s = PeerStream(stream, options, channel);
      s.init(function(err) {
        if (err) {
          console.error(err);
          s.end();
        }
      });
    });

    channel.once('end', function() {
      s.decrementUsersAndClose(function() {
        publicEmitter.emit('end');
      });
    });

    s.once('listening', function() {
      log('listening to port', port);
    });

    s.once('close', function() {
      log('server closed');
    });

    if (callback) s.once('listening', callback);
  }


  /// Send a message

  function sendMessage(msg) {
    channel.emit('message', msg);
  }

  
  /// End

  function end() {
    channel.emit('end');
  }

  publicEmitter.connect = connect;
  publicEmitter.listen = listen;
  publicEmitter.message = sendMessage;
  publicEmitter.end = end;

  return publicEmitter;
}

module.exports = RemoteChannel;