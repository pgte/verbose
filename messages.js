var defaultOptions = {
  maxMessages:  1000,
  timeout:      60 * 60 * 1e3 // 1 hour
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
    messages[id] = { message: message, id: id, meta: meta, expires: Date.now() + options.timeout };
    messageIds.push(id);
    if (messageIds.length > options.maxMessages) {
      var mId = messageIds.splice(0, 1)[0];
      delete messages[mId];
      if (currentIndex > 0) currentIndex --;
    }
    scheduleExpiration();
  };

  m.next =
  function next() {
    var id = messageIds[currentIndex];
    if (id) {
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
    scheduleExpiration();
    currentIndex = 0;
  };

  
  /// Expiration

  var timeout;
  function scheduleExpiration() {
    if (timeout) clearTimeout(timeout);
    timeout = undefined;
    if (messageIds.length) {
      var now = Date.now();
      var mId = messageIds[0];
      var expires = messages[mId].expires;
      timeout = setTimeout(expire, expires - now);
    }
  }

  function expire() {
    var now = Date.now();

    while(messageIds.length) {
      var mId = messageIds[0];
      var m = messages[mId];
      if (m.expires < now) {
        messageIds.splice(0, 1);
        delete messages[mId];
      } else break;
    }
    scheduleExpiration();
  }


  /// End

  m.end =
  function() {
    if (timeout) clearTimeout(timeout);
    messageIds = [];
    messages = {};
  };


  return m;
};