var test = require('tap').test;
var Node = require('..');
var helpers = require('./helpers');

var options = {
  channel: 'CHANNEL_1',
  timeout: 5e3
};


test('a => b => c', function(t) {
  t.plan(4);

  var a = Node(helpers.clone(options));
  var ea = a.emitter();
  var b = Node(helpers.clone(options));
  var eb = b.emitter();
  var c = Node(helpers.clone(options));
  var ec = c.emitter();

  var port1 = helpers.randomPort();
  var port2 = helpers.randomPort();

  b.listen(port1);
  a.connect(port2); // a => b

  c.listen(port2);
  b.connect(port2); // b => c

  var initializeds = 0;
  function initialized() {
    initializeds ++;
    if (initializeds >= 3) {
      ec.on('abc', function(_a, _b, _c) {
        t.ok(true, 'event reached node c');
        t.equal(_a, 'a');
        t.equal(_b, 'b');
        t.type(_c, 'undefined');
        a.end();
        b.end();
        c.end();
      });
      ea.emit('abc', 'a', 'b');
    }
  }

  a.once('initialized', initialized);
  b.once('initialized', initialized);
  c.once('initialized', initialized);

});

test('a => b, c => b', function(t) {
  t.plan(4);

  var a = Node(helpers.options({node_id: 'a'}));
  var ea = a.emitter();
  var b = Node(helpers.options({node_id: 'b'}));
  var eb = b.emitter();
  var c = Node(helpers.options({node_id: 'c'}));
  var ec = c.emitter();

  var port = helpers.randomPort();

  b.listen(port);
  a.connect(port); // a => b
  c.connect(port); // c => b

  var initializeds = 0;
  function initialized() {
    initializeds ++;
    if (initializeds >= 2) {
      ec.on('abc', function(_a, _b, _c) {
        t.ok(true, 'event reached node c');
        t.equal(_a, 'a');
        t.equal(_b, 'b');
        t.type(_c, 'undefined');
        a.end();
        b.end();
        c.end();
      });
      ea.emit('abc', 'a', 'b');
    }
  }

  a.once('initialized', initialized);
  c.once('initialized', initialized);

});


test('a => b, c => b, d => b', function(t) {
  t.plan(4);

  var a = Node(helpers.options({node_id: 'a'}));
  var ea = a.emitter();
  var b = Node(helpers.options({node_id: 'b'}));
  var eb = b.emitter();
  var c = Node(helpers.options({node_id: 'c'}));
  var ec = c.emitter();
  var d = Node(helpers.options({node_id: 'd'}));
  var ed = d.emitter();

  var port = helpers.randomPort();

  b.listen(port);
  a.connect(port); // a => b
  c.connect(port); // c => b
  d.connect(port); // d => b

  var initializeds = 0;
  function initialized() {
    initializeds ++;
    if (initializeds >= 3) {
      console.log('all initialized');
      ed.on('abc', function(_a, _b, _c) {
        t.ok(true, 'event reached node d');
        t.equal(_a, 'a');
        t.equal(_b, 'b');
        t.type(_c, 'undefined');
        a.end();
        b.end();
        c.end();
        d.end();
      });
      ea.emit('abc', 'a', 'b');
    }
  }

  a.once('initialized', initialized);
  c.once('initialized', initialized);
  d.once('initialized', initialized);

});