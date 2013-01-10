var duplexEmitter = require('duplex-emitter');
var Stream = require('stream');

function MockStream() {
  var s = new Stream();
  s.buf = '';
  s.writable = true;
  s.readable = true;
  s.write = function(b) {
    s.buf += b.toString();
  };
  s.end = function(b) {
    if (b) this.write(b);
    s.emit('end');
  }
  s.data = function(d) {
    s.emit('data', d);
  };
  s.emitter = duplexEmitter(s);;
  return s;
}

module.exports = MockStream;