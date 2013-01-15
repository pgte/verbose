var test = require('tap').test;
var Node = require('..');
var helpers = require('./helpers');

var options = {
  channel: 'CHANNEL_1',
  timeout: 5e3
};

test('emits from client to server', function(t) {

  t.plan(3);

  var s = Node(helpers.clone(options));
  var c = Node(helpers.clone(options));
  var port = helpers.randomPort();

  s.listen(port);
  c.connect(port);

  var ec = c.emitter();
  var es = s.emitter();

  es.on('abc', function(a, b, c) {
    t.equal(a, 'a');
    t.equal(b, 'b');
    t.type(c, 'undefined');
    ec.end();
    es.end();
  });

  ec.emit('abc', 'a', 'b');

});

test('emits from server to client', function(t) {

  t.plan(3);

  var s = Node(helpers.clone(options));
  var c = Node(helpers.clone(options));
  var port = helpers.randomPort();

  s.listen(port);
  c.connect(port);

  var ec = c.emitter();
  var es = s.emitter();

  ec.on('abc', function(a, b, c) {
    t.equal(a, 'hey1');
    t.equal(b, 'hey2');
    t.type(c, 'undefined');
    ec.end();
    es.end();
  });

  s.once('initialized', function() {
    es.emit('abc', 'hey1', 'hey2');
  });

});