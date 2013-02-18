var test = require('tap').test;
var net = require('net');

var Options = require('../options');
var BufferedPeer = require('../buffered_peer');
var helpers = require('./helpers');
var MockServer = require('./mock_server')

var options = {
  node_id: 'NODE_ID_1',
  timeout: 100,
  acknowledgeInterval: 100
};

test('it buffers and connects', function(t) {

  t.plan(1);

  var opts = Options(helpers.clone(options));

  var bp = BufferedPeer(opts);

  bp.write(['abc']);
  bp.write(['def']);

  var port = helpers.randomPort();

  var server = MockServer(helpers.clone(opts));
  var collected = [];
  
  server.on('message', function(d) {
    collected.push(d.pl);
    if (collected.length >= 2) {
      t.deepEqual(collected, [['abc'], ['def']]);
      bp.disconnect();
      server.close();
    }
  });
  
  server.listen(port);

  bp.connect(port);
  
});

test('it can start with a connected stream', function(t) {
  t.plan(1);

  var server = net.createServer();
  var port = helpers.randomPort();

  var opts = Options(helpers.clone(options));

  server.once('connection', function(conn) {
    var bps = BufferedPeer(opts, conn);
    bps.write(['abc']);
    bps.write(['def']);
  });

  var bpc = BufferedPeer(opts);
  bpc.connect(port);

  var collected = [];
  bpc.on('data', function(d) {
    collected.push(d[0]);
    if (collected.length >= 2) {
      t.similar(collected, ['abc', 'def']);
      bpc.disconnect();
      server.close();
    }

  })

  server.listen(port);
});
