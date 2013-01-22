var test = require('tap').test;
var PeerPool = require('../peer_pool');
var helpers = require('./helpers');

test('add wires up spine stream', function(t) {
  t.plan(2);

  var s = helpers.mockStream();
  var peers = PeerPool(s);
  var peer = helpers.mockStream();
  peers.add('id1', peer);

  peer.on('write', function(d) {
    t.deepEqual(d, ['ABC']);
    peer.emit('data', 'DEF')
  });

  s.on('write', function(d) {
    t.deepEqual(d, ['DEF']);
  });

  s.emit('data', 'ABC');
});

test('add connects to other peer', function(t) {
  t.plan(1);

  var s = helpers.mockStream();
  var peers = PeerPool(s);
  var peer1 = helpers.mockStream();
  peers.add('peer1', peer1);
  var peer2 = helpers.mockStream();
  peers.add('peer2', peer2);

  peer2.on('write', function(d) {
    t.deepEqual(d, ['ABCDEF']);
  });

  peer1.emit('data', 'ABCDEF');

});

test('when a peer ends it does not emit more data', function(t) {
  var s = helpers.mockStream();
  var peers = PeerPool(s);
  var peer = helpers.mockStream();
  peers.add('peer1', peer);

  peer.on('write', helpers.shouldNot('write on ended peer'));

  peer.emit('end');

  s.emit('data', 'ABCDEF');

  t.end();
});

test('add existing makes new peer inherit messages from the old one', function(t) {
  t.plan(1);
  
  var s = helpers.mockStream();
  var peers = PeerPool(s);
  var peer1 = helpers.mockStream();
  peer1.pendingMessages = function() {
    return ['ABC', 'DEF'];
  };

  peers.add('peer1', peer1);
  var peer2 = helpers.mockStream();
  peer2.takeMessages = function(messages) {
    t.deepEqual(messages, ['ABC', 'DEF']);
  };
  peers.add('peer1', peer2);
});