var test = require('tap').test;
var PeerList = require('../peer_list');
var helpers = require('./helpers');

test('add and get', function(t) {
  t.plan(1);
  var pl = PeerList();
  pl.add('id1', 'abc');
  pl.add('id2', 'def');
  t.equal(pl.get('id1'), 'abc');
});

test('add emits newpeer once', function(t) {
  t.plan(3);
  var pl = PeerList();
  pl.once('newpeer', function(id, peer) {
    t.ok(true, 'emitted newpeer');
    t.equal(id, 'id1');
    t.equal(peer, 'abc');
    pl.on('newpeer', helpers.shouldNot('emit newpeer more than once'));
  });
  pl.add('id1', 'abc');
  pl.add('id1', 'def');
});

test('remove', function(t) {
  t.plan(2);
  var pl = PeerList();
  pl.once('removepeer', function(id, peer) {
    t.equal(id, 'id1');
    t.equal(peer, 'abc');
    pl.on('removepeer', helpers.shouldNot('emit removepeer more than once'));
  });
  pl.add('id1', 'abc');
  pl.remove('id1');
  pl.remove('id1');
  pl.remove('id2');
});