var test = require('tap').test;
var RemoteChannel = require('..');
var helpers = require('./helpers');

function end() {
  var channels = Array.prototype.slice.call(arguments);
  var cb = channels.pop();
  
  if (typeof(cb) !== 'function') throw new Error('last arg should be callaback');

  var left = channels.length;
  console.log('I have %d channels to end', left);
  channels.forEach(function(channel) {
    channel.end();
    channel.once('end', function() {
      left --;
      if  (left === 0) {
        console.log('calling back');
        cb();
      }
    });
  });
}

/// ---- Tests

test('can listen, connect and send message', function(t) {

  t.plan(3);

  var port = helpers.randomPort();
  var rta = RemoteChannel('channel1');
  var rtb = RemoteChannel('channel1');

  rta.on('message', function(msg) {
    console.log('(1)');
    t.deepEqual(msg, 'event2');
  });

  rtb.on('message', function(msg) {
    console.log('(2)');
    t.deepEqual(msg, 'event1');
  });

  rta.listen(port);
  rtb.connect(port);
  rta.message('event1');
  rtb.message('event2');
  
  end(rta, rtb, function() {
    console.log('ended');
    t.ok(true, 'ended');
  });
  
});

return;


test('server emits the end event when it ends', function(t) {
  t.plan(1);

  var rc = RemoteChannel('channel');
  rc.listen(helpers.randomPort());
  rc.on('end', function() {
    t.ok(true, 'ending');
  });
  rc.end();
});


test('disconnected channels dont emit events', function(t) {
  t.plan(1);

  var port = helpers.randomPort();

  // Different channels for each:
  var rta = RemoteChannel('channel1');
  var rtb = RemoteChannel('channel2');

  rta.on('message', helpers.shouldNot('rta should not get message'));
  rtb.on('message', helpers.shouldNot('rtb should not get message'));

  rta.listen(port);
  rtb.connect(port);
  rta.message('event1');
  rtb.message('event2');
  setTimeout(function() {
    rtb.end();
    rta.end();
    t.ok(true, 'end');
  }, 100);
});

return;

test('client reconnect works', function(t) {
  t.plan(2);

  var port = helpers.randomPort();
  var rta = RemoteChannel({channel: 'channel1', node_id: 'SERVER'});
  var rtb = RemoteChannel({channel: 'channel1', node_id: 'CLIENT'});

  rta.on('message', function(msg) {
    t.deepEqual(msg, 'event2');
  });

  rtb.on('message', helpers.shouldNot('rtb should not get message'));

  rta.listen(port);
  rtb.connect(port);
  rtb.once('connect', function() {
    rtb.end();
    console.log('ordered stream to end');
    rtb.once('end', function() {
      console.log('rtb::end');
      rta.message('event1');
      rtb.message('event2');
      console.log('sent client message');
      rtb.connect(port);
      
      rtb.once('connect', function() {
        console.log('FINALLY connected again');
        setTimeout(function() {
          rtb.end();
          rta.end();
          t.ok(true, 'ended')
        }, 1000);
      });
    });
    console.log('registered for rtb::end');
  });
});

return;



//test('supports TLS');

//test('cannot connect to more than one destination');