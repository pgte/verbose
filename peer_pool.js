var EventEmitter = require('events').EventEmitter;

exports =
module.exports = 
function PeerList(spine) {

  var ee = new EventEmitter();

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
  }

  ee.add =
  function add(id, peer) {
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

  return ee;
};