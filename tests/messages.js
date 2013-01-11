var test = require('tap').test;
var Messages = require('../messages');

test('push and length', function(t) {
  var m = Messages();
  m.push('message 1', 'id1', 'meta1');
  m.push('message 2', 'id2', 'meta2');
  t.equal(m.length(), 2);
  t.end();
});

test('next', function(t) {
  var m = Messages();
  m.push('message 1', 'id1', 'meta1');
  m.push('message 2', 'id2', 'meta2');
  t.deepEqual(m.next(), {message: 'message 1', id: 'id1', meta: 'meta1'});
  t.deepEqual(m.next(), {message: 'message 2', id: 'id2', meta: 'meta2'});
  t.type(m.next(), 'undefined');
  t.equal(m.length(), 0);
  t.end();
});

test('acknowledge', function(t) {
  var m = Messages();
  m.push('message 1', 'id1', 'meta1');
  m.push('message 2', 'id2', 'meta2');
  m.push('message 3', 'id3', 'meta3');
  m.push('message 4', 'id4', 'meta4');
  m.acknowledge('id2');
  t.equal(m.length(), 2);
  t.deepEqual(m.next(), {message: 'message 3', id: 'id3', meta: 'meta3'});
  t.end();
});