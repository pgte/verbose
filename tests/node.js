var test = require('tap').test;
var Node = require('..');
var helpers = require('./helpers');

var options = {
  channel: 'CHANNEL_1',
  timeout: 5e3
};

test('server emits', function(t) {
  t.plan(1);
  var s = Node(helpers.clone(options));
  var c = Node(helpers.clone(options));
  var port = helpers.randomPort();

  c.connect(port);
  s.listen(port);

  c.write('message 1');
  c.write('message 2');

  var collected = []; // collect data from server here

  s.on('data', function(d) {
    collected.push(d);
    if (collected.length == 2) {
      t.deepEqual(collected, ['message 1', 'message 2']);
      s.end();
      c.end();
    }
  });

});

// test('client emits')

// test('several clients connected to server')

// test('client connected to several servers')

// test('flow control')