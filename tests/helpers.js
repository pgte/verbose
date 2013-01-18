var PeerStream = require('../peer_stream');
var DuplexEmitter = require('duplex-emitter');
var Stream = require('stream');
var EventEmitter = require('events').EventEmitter;
var reconnect = require('reconnect');


exports.shouldNot =
function shouldNot(msg) {
  return function() {
    throw new Error(msg);
  }
};

exports.randomPort =
function randomPort() {
  return Math.floor(Math.random() * 10000) + 1024;
};

exports.clone =
function clone(o) {
  return JSON.parse(JSON.stringify(o));
};

var defaultOptions =
{
  channel: 'CHANNEL_1',
  timeout: 5e3
};

function merge(a, b) {
  for(var p in b) if (b.hasOwnProperty(p)) a[p] = b[p];
}

exports.options =
function options(opts) {
  if (! opts) opts = {};
  var options = {};
  merge(options, defaultOptions);
  merge(options, opts);
  return options;
};

exports.hub =
function hub() {
  return new EventEmitter();
};

exports.connect =
function(port, options, hub, callback) {
  console.log(arguments);
  var recon = reconnect(function(stream) {
    var ps = PeerStream(stream, options, hub);
    callback(ps);
  }).connect(port);

  return recon;
}

exports.mockStreamPair =
function() {
  var s1 = new Stream();
  var s2 = new Stream();
  s1.writable =
  s1.readable =
  s2.writable =
  s2.readable =
  true;

  s1.end = function() {
    s2.emit('end');
  };

  s2.end = function() {
    s1.emit('end');
  };

  s1.write = function write1(d) {
    process.nextTick(function() {
      s2.emit('data', d);
    });
  };

  s2.write = function write2(d) {
    process.nextTick(function() {
      s1.emit('data', d);
    });
  };

  return [s1, s2];

}

exports.remotePeer =
function(peerid, options, stream) {
  
  var emitter = DuplexEmitter(stream);
  
  emitter.once('peerid', function() {
    emitter.emit('peerid', options.channel, peerid);
  });

  emitter.once('sync', function() {
    emitter.emit('sync');
  });

  return emitter;
}