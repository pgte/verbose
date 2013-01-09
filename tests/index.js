var test = require('tap').test;
var RemoteChannel = require('..');

test('can listen, connect and send message', function(t) {

  var pending = 2;
  t.plan(2);

  function gotMessage() {
    if (-- pending === 0) {
      rtb.end();
      rta.end();
    }
  }

  var port = Math.floor(Math.random() * 10000) + 1024;
  var rta = RemoteChannel('channel1');
  var rtb = RemoteChannel('channel1');

  rta.on('message', function(msg) {
    t.deepEqual(msg, 'event2');
    gotMessage();
  });

  rtb.on('message', function(msg) {
    t.deepEqual(msg, 'event1');
    gotMessage();
  });

  rta.listen(port);
  rtb.connect(port);
  rta.message('event1');
  rtb.message('event2');
  
});

//test('supports TLS');