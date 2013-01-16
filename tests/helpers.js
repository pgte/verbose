var EventEmitter = require('events').EventEmitter;

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