var defaultOptions = {
  maxRetention: 1000,
  maxAge:       60 * 60 * 1e3 // 1 hour
};

module.exports =
function create(options) {

  var m = {};

  /// Options

  if (! options) options = {};

  for(var p in defaultOptions) {
    if (! options[p]) options[p] = defaultOptions[p];
  }

  /// Messages

  var messages = {};
  var messageIds = [];
  var currentIndex = 0;

  m.push =
  function push(message, id, meta) {
    messages[id] = { message: message, id: id, meta: meta };
    messageIds.push(id);
  };

  m.next =
  function next() {
    if (messageIds.length) {
      var id = messageIds.splice(0, 1)[0];
      var m = messages[id];
      currentIndex ++;
      return m;
    }
  };

  m.length =
  function length() {
    return messageIds.length;
  }

  m.acknowledge =
  function acknowledge(id) {
    var mId;
    while(messageIds.length) {
      mId = messageIds.splice(0, 1)[0];
      delete messages[mId];
      if (mId == id) break;
    }
    currentIndex = 0;
  };

  return m;
};