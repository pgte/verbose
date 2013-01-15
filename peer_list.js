var EventEmitter = require('events').EventEmitter;

exports =
module.exports = 
function PeerList() {

  var ee = new EventEmitter();

  var peers = {};

  ee.get =
  function get(id) {
    return peers[id];
  }

  ee.add =
  function set(id, peer) {
    var existing = peers[id];
    peers[id] = peer;
    if (! existing) ee.emit('newpeer', id, peer);
  };

  ee.remove =
  function remove(id) {
    var existing = peers[id];
    delete peers[id];
    if (existing) ee.emit('removepeer', id, existing);
  };

  ee.length =
  function() {
    return Object.keys(peers).length;
  };

  ee.all =
  function() {
    return Object.keys(peers).map(function(k) { return peers[k]; });
  };

  return ee;
};