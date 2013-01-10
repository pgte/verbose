var test = require('tap').test;
var Reconnect = require('../reconnect');
var EventEmitter = require('events').EventEmitter;
var helpers = require('./helpers');

var options = helpers.clone(require('../options').defaults);
options.channel = 'CHANNEL_1';

var MockServer = require('./mock_server');


test('initiates', function(t) {
  t.plan(1);
  var port = helpers.randomPort();
  var server = MockServer(options);
  var channel = new EventEmitter();
  
  var peer = Reconnect(port, undefined, options, channel);
  
  peer.on('initiated', function() {
    t.ok(peer.stream, 'has stream');
    channel.emit('end');
    server.close();
  });
  
  server.listen(port);
});

test('reconnects', function(t) {
  t.plan(3);
  var port = helpers.randomPort();
  var server = MockServer(options);
  var channel = new EventEmitter();
  
  var peer = Reconnect(port, undefined, options, channel);
  
  peer.once('initiated', function() {
    t.ok(peer.stream, 'has stream');
    server.forceClose();
    peer.once('disconnect', function() {
      t.ok(true, 'disconnected');
      server.listen(port);
      peer.once('initiated', function() {
        t.ok(true, 'initiated');
        channel.emit('end');
        server.close();
      });
    });
  });
  
  server.listen(port);
});