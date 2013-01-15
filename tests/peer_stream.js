var test = require('tap').test;
var PeerStream = require('../peer_stream');
var MockServer = require('./mock_server');
var helpers = require('./helpers');
var async = require('async');
var es = require('event-stream');
var fs = require('fs');

var options = {
  node_id: 'NODE_ID_1',
  channel: 'CHANNEL_1',
  log:     function() {},
  timeout: 1000,
  acknowledgeInterval: 100
};


test('handshakes', function(t) {
  t.plan(3);
  
  var port = helpers.randomPort();
  var server = MockServer(options);
  var s = PeerStream(options);
  
  s.connect(port)
  
  async.parallel([
    
    function(done) {
      s.once('connect', function() {
        t.ok(true, 'got connection');
        done();
      });
    },

    function(done) {
      s.once('initialized', function() {
        t.ok(true, 'initialized');
        done();
      });
    }

  ], done);
  
  server.listen(port);

  function done(err) {
    t.ok(! err);
    s.end();
    server.close();    
  }
});

test('errors on wrong channel', function(t) {
  t.plan(2);
  
  var serverOptions = helpers.clone(options);
  serverOptions.channel = 'WRONG_CHANNEL';
  var server = MockServer(serverOptions);

  var port = helpers.randomPort();
  var s = PeerStream(options);
  
  s.connect(port)
  
  s.once('error', function(err) {
    t.ok(err);
    t.equal(err.message, 'wrong channel name: WRONG_CHANNEL. Expected CHANNEL_1');
    s.end();
    server.close();    
  });

  server.listen(port);
});

test('sends message', function(t) {
  t.plan(1);
  
  var server = MockServer(options);

  var port = helpers.randomPort();
  var s = PeerStream(options);
  
  s.write('this is a message');
  s.end();
  s.connect(port)
  server.listen(port);

  // Give some time for this message
  // to reach the server
  setTimeout(function() {
    t.deepEqual(server.messages, ['this is a message']);
    server.close();    
  }, 500);

});

test('supports pipe', function(t) {
  t.plan(1);
  var server = MockServer(options);

  var port = helpers.randomPort();
  var s = PeerStream(options);

  s.connect(port);
  es.pipeline(
    fs.createReadStream(__dirname + '/events.txt'),
    es.split()
  ).pipe(s);

  server.listen(port);

  // Give some time for this message
  // to reach the server
  setTimeout(function() {
    t.deepEqual(server.messages, [
      'event one',
      'event two',
      'event three']);
    server.close();    
  }, 500);

});

test('reconnects', function(t) {
  t.plan(1);

  var server = MockServer(options);

  var port = helpers.randomPort();
  var s = PeerStream(options);

  server.listen(port);
  s.connect(port);
  
  s.once('connect', function() {
    server.forceClose();
    server.once('close', function() {
      s.write('one message');
      s.end();
      server.listen(port);

      // Give some time for this message
      // to reach the server
      setTimeout(function() {
        t.deepEqual(server.messages, [ 'one message' ]);
        server.close();
      }, 500);
    });
  });

});


test('emits data on server message', function(t) {
  t.plan(1);

  var server = MockServer(options);

  var port = helpers.randomPort();
  var s = PeerStream(options);

  var collected = [];
  s.on('data', function(d) {
    collected.push(d);
    if (collected.length >= 2) {
      t.deepEqual(collected, ['message 1', 'message 2']);
      s.end();
      server.close();      
    }
  });
  s.connect(port);

  server.send = [
    ['message 1', {id: 1, nodes: ['a']}],
    ['message 2', {id: 2, nodes: ['a']}]
  ];

  server.listen(port);

});

test('acknowledges message and removes from buffer', function(t) {
  t.plan(3);

  var server = MockServer(options);

  var port = helpers.randomPort();
  var s = PeerStream(options);

  setTimeout(function() {
    t.ok(server.acknowledges.length > 0, 'server got acknowledges');
    t.ok(server.acknowledges.indexOf('def') >= 0, 'server got acknowledge for last msg');
    t.equal(s.bufferLength(), 0);
    s.end();
    server.close();
  }, 500);

  s.connect(port);

  server.send = [
    ['message 1', {id: 'abc', nodes: ['a']}],
    ['message 2', {id: 'def', nodes: ['a']}]
  ];

  server.listen(port);
});

test('emits acknowledges', function(t) {
  t.plan(3);

  var server = MockServer(options);

  var port = helpers.randomPort();
  var s = PeerStream(options);
  s.write('abc');
  s.write('def');

  var acknowledges = 0;
  s.on('acknowledge', function(id) {
    t.ok(!! id);
    acknowledges ++;
    if (acknowledges >= 2) {
      t.ok(true, 'ended');
      s.end();
      server.close();
    }
  });

  s.connect(port);

  server.listen(port);
});


test('buffering messages time out', function(t) {
  t.plan(2);
  
  var opts = helpers.clone(options);
  
  opts.bufferTimeout = 10;
  
  var server = MockServer(opts);
  server.acknowledge = false;
  var port = helpers.randomPort();
  var s = PeerStream(opts);

  // safeguard to ensure the server is not acknowledging
  s.on('acknowledge', helpers.shouldNot('should not acknowledge'));

  s.connect(port);
  s.write('abc');
  s.write('def');

  t.equal(s.bufferLength(), 2);

  setTimeout(function() {
    t.equal(s.bufferLength(), 0);
    s.end();
    server.close();
  }, 500);

  server.listen(port)
});


test('synchronizes missing messages', function(t) {
  
  t.plan(5);
  
  var server = MockServer(options);
  var port = helpers.randomPort();
  var s = PeerStream(options);

  server.acknowledge = false;
  server.listen(port);
  s.connect(port);
  s.write('ghi');
  s.write('jkl');
  s.write('mno');

  setTimeout(function() {
    t.deepEqual(server.messages, ['ghi', 'jkl', 'mno']);
    t.equal(server.metas.length, 3)
    t.equal(s.bufferLength(), 3);

    var firstId = server.metas[0].id;
    t.ok(!! firstId);
    
    // reset messages
    server.metas = [];
    server.messages = [];

    server.forceClose();

    server.once('close', function() {
      server.sync = firstId;
      server.listen(port);

      setTimeout(function() {
        t.deepEqual(server.messages, ['jkl', 'mno']);
        s.end();
        server.close();
      }, 500);

    });

  }, 500);
});

test('reconnects on timeout', function(t) {
  t.plan(2);

  var server = MockServer(options);
  var port = helpers.randomPort();
  var s = PeerStream(options);

  server.listen(port);

  server.send = [
    ['message 1', {id: 'qwe', nodes: ['a']}],
    ['message 2', {id: 'rty', nodes: ['a']}]
  ];

  s.connect(port);
  var collected = [];
  s.on('data', function(d) {
    collected.push(d);
    server.send = [];
    if (collected.length >= 2) {
      s.once('timeout', function() {
        t.ok(true, 'got timeout');
        s.once('initialized', function() {
          t.ok('ended', true);
          s.end();
          server.close();
        });
      });
    }
  });

});

test('emits the end event when ends', function(t) {

  t.plan(1);

  var server = MockServer(options);
  var port = helpers.randomPort();
  var s = PeerStream(options);

  server.listen(port);

  s.connect(port);

  s.on('initialized', function() {
    s.once('end', function() {
      t.ok(true, 'ended');
      server.close();
    });
    s.end();
  });

});

test('emits the end event only once', function(t) {

  t.plan(1);

  var server = MockServer(options);
  var port = helpers.randomPort();
  var s = PeerStream(options);

  server.listen(port);

  s.connect(port);

  s.on('initialized', function() {
    s.once('end', function() {
      t.ok(true, 'ended');
      s.on('end', helpers.shouldNot('emit end event more than once'));
      server.close();
    });
    s.end();
  });

});

// test('spits out stream stats')

// test('be killable')