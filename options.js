var uuid = require('node-uuid');

var defaults =
{
  timeout : 5e3,
  bufferTimeout: 15 * 60 * 1e3, // 15 minutes
  bufferMax: 1000,
  acknowledgeInterval: 1e3,
  channel: 'DEFAULT_CHANNEL'
};

function merge(a, b) {
  for(var p in b) {
    if (b.hasOwnProperty(p)) a[p] = b[p];
  }
}

exports =
module.exports =
function Options(opts) {
  var options = {};
  merge(options, defaults);

  if (! opts) opts = {};
  if (typeof opts === 'string') {
    opts = {
      channel: opts
    };
  }

  merge(options, opts);

  if (! options.node_id) options.node_id = uuid.v4();

  return options;
}

module.exports.defaults = defaults;