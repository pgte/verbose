require('colors')
var uuid = require('node-uuid');
var slice = Array.prototype.slice;

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

var defaults =
{
  timeout : 5e3,
  bufferTimeout: 15 * 60 * 1e3, // 15 minutes
  bufferMax: 1000,
  acknowledgeInterval: 1e3
};

module.exports =
function Options(options) {
  if (! options) options = {};
  if (typeof options === 'string') {
    var channelName = options;
    options = {
      channel: channelName
    };
  }
  if (! options.channel) options.channel = 'DEFAULT_CHANNEL';

  if (! options.node_id) options.node_id = uuid.v4();

  if (options.log || process.env.FORCE_LOG) {
    options.log = function() {
      var args = slice.call(arguments);
      args.unshift(('[' + options.node_id + '::' + options.channel + ']').blue);
      console.log.apply(console, args);
    }
  } else {
    options.log = function() {};
  }

  for (var p in defaults) {
    if (! options[p]) options[p] = defaults[p];
  }

  return options;
}

module.exports.defaults = defaults;