var test = require('tap').test;
var PeerStream = require('../peer_stream');
var MockStream = require('./mock_stream');
var EventEmitter = require('events').EventEmitter;

var options = {
  node_id: 'NODE_ID_1',
  channel: 'CHANNEL_1',
  log:     function() {}
};

test('handshakes', function(t) {
  t.plan(2);
  
  var s = MockStream();
  s.on('write', function(b) {
    console.log('wrote', b);
  });
  var channel = new EventEmitter();
  var peer = PeerStream(s, options, channel);
  peer.init(function(err) {
    t.type(err, 'undefined');
    t.equal(s.buf, '[\n'+
      '["channel","CHANNEL_1"]');
  });
  s.data('[\n'+
      '["channel","CHANNEL_1"]');
});

test('errors on wrong channel', function(t) {
  t.plan(1);
  
  var s = MockStream();
  s.on('write', function(b) {
    console.log('wrote', b);
  });
  var channel = new EventEmitter();
  var peer = PeerStream(s, options, channel);
  peer.init(function(err) {
    t.type(err, Error);
  });
  s.data('[\n'+
      '["channel","CHANNEL_2"]');
});

test('sends message', function(t) {
  t.plan(2);
  
  var s = MockStream();
  var channel = new EventEmitter();
  var peer = PeerStream(s, options, channel);
  peer.init(function(err) {
    t.type(err, 'undefined');
  });
  channel.emit('message', 'MESSAGE_1')
  
  process.nextTick(function() {
    t.equal(s.buf, '[\n' +
      '["channel","CHANNEL_1"]\n' +
      ',\n' +
      '["message","MESSAGE_1",{"nodes":["NODE_ID_1"]}]');
  });
  s.data('[\n'+
      '["channel","CHANNEL_1"]');

});

test('end gets queued and doesnot execute immediately', function(t) {
  t.plan(2);
  
  var s = MockStream();
  var channel = new EventEmitter();
  var peer = PeerStream(s, options, channel);
  peer.init(function(err) {
    t.type(err, 'undefined');
  });
  channel.emit('message', 'MESSAGE_1')
  channel.emit('end');
  
  process.nextTick(function() {
    t.equal(s.buf, '[\n' +
      '["channel","CHANNEL_1"]\n' +
      ',\n' +
      '["message","MESSAGE_1",{"nodes":["NODE_ID_1"]}]');
  });
  s.data('[\n'+
      '["channel","CHANNEL_1"]');

});

test('does not send message after stream end', function(t) {
  t.plan(2);
  
  var s = MockStream();
  var channel = new EventEmitter();
  var peer = PeerStream(s, options, channel);
  peer.init(function(err) {
    t.type(err, 'undefined');
  });
  channel.emit('message', 'MESSAGE_1')
  
  process.nextTick(function() {
    peer.end();
    channel.emit('message', 'MESSAGE_2');
    process.nextTick(function() {
      t.equal(s.buf, '[\n' +
        '["channel","CHANNEL_1"]\n' +
        ',\n' +
        '["message","MESSAGE_1",{"nodes":["NODE_ID_1"]}]');
    });
  });
  s.data('[\n'+
      '["channel","CHANNEL_1"]');

});