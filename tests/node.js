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
    if (collected.length >= 2) {
      t.deepEqual(collected, ['message 1', 'message 2']);
      s.end();
      c.end();
    }
  });

});

test('client emits', function(t) {
  t.plan(1);
  var s = Node(helpers.clone(options));
  var c = Node(helpers.clone(options));
  var port = helpers.randomPort();
  c.connect(port);

  s.listen(port, function() {
    c.on('initialized', function() {
      s.write('message 2.1');
      s.write('message 2.2');
    });
  });

  var collected = [];
  c.on('data', function(d) {
    collected.push(d);
    if (collected.length >= 2) {
      t.deepEqual(collected, ['message 2.1', 'message 2.2']);
      c.end();
      s.end();
    }
  });

});


test('initialized and end events happen only once', function(t) {
  t.plan(4);
  
  var s = Node(helpers.clone(options));
  var c = Node(helpers.clone(options));
  var port = helpers.randomPort();
  
  c.connect(port);

  var initializedCount = 0;
  function initialized() {
    initializedCount ++;
    t.ok(initializedCount <= 2, 'doesnt emit initialized more than once');
    if (initializedCount >= 2) {
      c.once('end', function() {
        t.ok(true, 'c.ended');
        c.on('end', helpers.shouldNot('c.end more than once'));
      });
      s.once('end', function() {
        t.ok(true, 's.ended');
        s.on('end', helpers.shouldNot('s.end more than once'));
      });
      c.end();
      s.end();
    }

  }
  
  c.on('initialized', initialized);
  s.on('initialized', initialized);
  
  s.listen(port);
});


test('several clients connected to server', function(t) {

  t.plan(4);
  var s = Node(helpers.clone(options));
  var c1 = Node(helpers.clone(options));
  var c2 = Node(helpers.clone(options));
  var port = helpers.randomPort();
  c1.connect(port);
  c2.connect(port);
  s.listen(port);

  c1.write('abc');
  c2.write('def');
  c1.write('ghi');
  c2.write('jkl');

  var collected = [];
  s.on('data', function(d) {
    collected.push(d);
    if (collected.length >= 4) {
      t.ok(collected.indexOf('abc') >= 0, 'got message 1');
      t.ok(collected.indexOf('def') >= 0, 'got message 2');
      t.ok(collected.indexOf('ghi') >= 0, 'got message 3');
      t.ok(collected.indexOf('jkl') >= 0, 'got message 4');
      c1.end();
      c2.end();
      s.end();
    }
  });

});

test('server peer resends missed events', function(t) {
  t.plan(4);
  var port = helpers.randomPort();
  var c1 = Node(helpers.clone(options));
  var s = Node(helpers.clone(options));
  s.listen(port);

  var reconnected = false;
  var collected = [];
  c1.on('data', function(d) {
    t.ok(reconnected, 'already reconnected');
    collected.push(d);
    if (collected.length >= 3) {
      t.deepEqual(collected, ['abc', 'def', 'ghi']);
      c1.end();
      s.end();
    }
  });

  c1.connect(port);

  c1.once('initialized', function() {
    s.write('abc');
    s.write('def');
    s.write('ghi');
    c1.disconnect();
    c1.once('disconnect', function() {
      reconnected = true;
      c1.connect(port);
    });
  });

});

test('after disconnected for a long time and a peer gets garbage-collected', function(t) {
  t.plan(1);
  
  var port = helpers.randomPort();
  
  var c = Node(helpers.clone(options));
  
  var serverOptions = helpers.clone(options);
  serverOptions.bufferTimeout = 100;
  var s = Node(serverOptions);
  
  s.listen(port);
  c.connect(port);
  
  c.once('initialized', function() {
    t.equal(s.peers().length, 1, 'server has one peer');
    c.end();
    setTimeout(function() {
      t.equal(s.peers().length, 0, 'server has no peers');
      s.end();
    }, 500);
  });
});

test('client connected to several servers', function(t) {

  t.plan(6);
  
  var s1 = Node(helpers.clone(options));
  var s2 = Node(helpers.clone(options));
  var c1 = Node(helpers.clone(options));
  var port1 = helpers.randomPort();
  var port2 = helpers.randomPort();
  s1.listen(port1);
  s2.listen(port2);
  c1.connect(port1);
  c1.connect(port2);

  c1.write('abc');
  c1.write('def');
  c1.write('ghi');

  var validated = 0;
  function validateCollected(collected) {
    t.ok(collected.indexOf('abc') >= 0, 'got message 1');
    t.ok(collected.indexOf('def') >= 0, 'got message 2');
    t.ok(collected.indexOf('ghi') >= 0, 'got message 3');
    validated ++;
    if (validated >= 2) {
      c1.end();
      s1.end();
      s2.end();
    }
  }

  var collected1 = [];
  s1.on('data', function(d) {
    console.log('s1 data', d);
    collected1.push(d);
    if (collected1.length >= 3) validateCollected(collected1);
  });

  var collected2 = [];
  s2.on('data', function(d) {
    console.log('s2 data', d);
    collected2.push(d);
    if (collected2.length >= 3) validateCollected(collected2);
  });

});