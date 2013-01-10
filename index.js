'use strict';

require('colors');
var EventEmitter = require('events').EventEmitter;
var server = require('./server');
var Options = require('./options');
var Reconnect = require('./reconnect');

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

    var peer = Reconnect(port, host, options, channel, callback);

  }


  /// Listen

  function listen(port, host, callback) {
    isServer = true;
    log('listen');
    if (typeof host === 'function') {
      callback = host;
      host = undefined;
    }
    var s = server.create().listen(port, host);
    s.incrementUsers();

    s.on('connection', function(stream) {
      log('server connection');
      var s = Peer(stream, options, channel);
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
      log('listening');
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