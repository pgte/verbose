var EventEmitter = require('events').EventEmitter;
var Options = require('./options');

exports =
module.exports = 
function PeerList(spine, opts) {


  var options = Options(opts);
  var ee = new EventEmitter();
  var ending = false;
  var ended = false;

  var peers = {};

  function wireup(id, peer) {

    /// Pipe all messages emitted by spine into this peer
    spine.pipe(peer);

    /// Pipe all messages emitted by this peer into the spine
    peer.pipe(spine);

    Object.keys(peers).forEach(function(peerId) {
      if (peerId != id) {
        var otherPeer = peers[peerId];
        peer.pipe(otherPeer).pipe(peer);        
      }
    });

    peer.once('end', function() {
      console.log('peer ended');
      function onReplaced() {
        peer.removeListener('replaced', onReplaced);
        if (timeout) clearTimeout(timeout);
        timeout = undefined;
      }
      peer.on('replaced', onReplaced);

      if (! ending) {
        var timeout = setTimeout(function() {
          peer.removeListener('replaced', onReplaced);
          delete peers[id];
        }, options.bufferTimeout);

        ee.once('ending', function() {
          if (timeout) clearTimeout(timeout);
          timeout = undefined;
        });  
      }

    });
  }

  ee.add =
  function add(id, peer) {
    if (ended) throw new Error('Ended');
    var existing = peers[id];
    peers[id] = peer;

    wireup(id, peer);

    /// Take messages from old peer and
    if (existing) {
      peer.takeMessages(existing.pendingMessages());
      // peerStream.lastMessageId = existingPeer.lastMessageId;
      // peerStream.connectedTimes += existingPeer.connectedTimes;
      existing.emit('replaced');
    }

    if (! existing) {
      ee.emit('new', id, peer);
    }

  };

  ee.list =
  function list() {
    return Object.keys(peers).map(function(id) {
      return peers[id];
    });
  };

  ee.end =
  function end() {
    ending = true;
    ee.emit('ending');
    Object.keys(peers).forEach(function(id) {
      var peer = peers[id];
      if (! peer.ended) peer.end();
    });
  }

  return ee;
};