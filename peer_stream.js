var duplexEmitter = require('duplex-emitter');
var EventEmitter = require('events').EventEmitter;

function Stream(stream, options, emitter) {
  var remoteEmitter = duplexEmitter(stream);
  var publicEmitter = new EventEmitter();
  var queue = [];
  var ended = false;

  function flush() {
    if (ended) return;
    if (queue.length) {
      flushing = true;
      var action = queue.splice(0, 1)[0];
      var method = action[0];
      var args = action[1];
      if (! Array.isArray(args)) args = [args];
      
      args.push(flush); // callback function
      method.apply(this, args);
    }
    
  }

  function init(callback) {

    var timeout = setTimeout(function() {
      callback(new Error(
        'timeout waiting for channel handshake. Waited for ' + options.timeout + ' ms'));
    }, options.timeout);

    remoteEmitter.once('channel', function(channel) {
      clearTimeout(timeout);
      if (channel != options.channel) {
        return callback(
          new Error(
            'wrong channel name:' + channel + '. Expected ' + options.channel));
      }
      return callback();
    });

    // Send handshake
    remoteEmitter.emit('channel', options.channel);

    // Listen for remote messages
    function remoteMessage(msg, meta) {
      if (meta.nodes.indexOf(options.node_id) === -1) {
        meta.nodes.push(options.node_id);
        publicEmitter.emit('message', msg);
      }
    }

    remoteEmitter.on('message', remoteMessage);

    // Channel emitter messages to queueSend()
    emitter.on('message', queueSend);

    // Unregister event listeners once stream ends
    // Preventing leaks
    stream.once('end', function() {
      remoteEmitter.removeListener('message', remoteMessage);
      emitter.removeListener('message', send);
      publicEmitter.emit('end');
    });
  }

  function send(msg, done) {
    var meta = {
      nodes: [options.node_id]
    };
    remoteEmitter.emit('message', msg, meta);
    done();
  }

  function queueSend(msg) {
    queue.push([send, msg]);
    flush();
  }

  function end(callback) {
    stream.end();
    stream.once('end', function() {
      ended = true;
      callback();
    });
  }

  function queueEnd() {
    queue.push([end]);
    flush();
  }

  publicEmitter.send = queueSend;
  publicEmitter.end = queueEnd;
  publicEmitter.init = init;

  return publicEmitter;
}

module.exports = Stream;