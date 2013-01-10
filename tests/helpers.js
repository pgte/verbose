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