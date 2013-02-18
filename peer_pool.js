var EventEmitter = require('events').EventEmitter;
var Options = require('./options');

exports =
module.exports = 
function PeerPool(spine, opts) {


  var options = Options(opts);
  var ee = new EventEmitter();
  var ending = false;
  var ended = false;

  var peers = [];

  function remove(peer) {
    var idx = peers.indexOf(peer);
    if (idx > -1) peers.splice(idx, 1);
  }

  function wireup(peer) {

    /// Pipe all messages emitted by spine into this peer
    spine.pipe(peer);

    /// Pipe all messages emitted by this peer into the spine
    peer.pipe(spine);

    peers.forEach(function(otherPeer) {
      if (peer != otherPeer) {
        peer.pipe(otherPeer).pipe(peer);        
      }
    });

    peer.once('end', function() {
      remove(peer);
    });
  }

  ee.add =
  function add(peer) {
    if (ended) throw new Error('Ended');
    wireup(peer);
    peers.push(peer);
  };

  ee.list =
  function list() {
    return peers;
  };

  ee.end =
  function end() {
    ending = true;
    ee.emit('ending');
    peers.forEach(function(peer) {
      peer.end();
    });
  }

  return ee;
};