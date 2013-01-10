var net = require('net');
var server;
var users = 0;

function incrementUsers() {
  users ++;
}

function decrementUsersAndClose(callback) {
  users --;
  if (! users) {
    server.close();
    server.once('close', callback);
  } else {
    callback();
  }
}

function create(port, host) {
  if (! server) {
    server = net.createServer();
    server.incrementUsers = incrementUsers;
    server.decrementUsersAndClose = decrementUsersAndClose;
  }
  return server;
}

module.exports = {
  create: create
};