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
  timeout: 5e3
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
      s.once('initiated', function() {
        t.ok(true, 'initiated');
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
    if (collected.length == 2) {
      t.deepEqual(collected, ['message 1', 'message 2']);
      s.end();
      server.close();      
    }
  });
  s.connect(port);

  server.send = [
    'message 1',
    'message 2'
  ];

  server.listen(port);

});

// test('synchronizes missing messages')

// test('sends missing messages after reconnect')

// test('pings')

// test('spits out stream stats')