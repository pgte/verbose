# verbose [![Build Status](https://secure.travis-ci.org/pgte/verbose.png)](http://travis-ci.org/pgte/verbose)


Distributed event bus

## Create a Node

```javascript
var verbose = require('verbose');
var node = verbose();
```

You can also give it some options:

```javascript
var options = {
  node_id: 'NODE-ID-000001'
};

var node = verbose(options);
```

Here are the options:

---------------------------------------------------------------
| option      | description                     |  default    |
---------------------------------------------------------------
| node_id     | node identifier for other peers | random UUID |
---------------------------------------------------------------
| timeout     | inactivity timeout (ms)         | 60000       |
---------------------------------------------------------------
| bufferTimeout     | maximum retransmit resilience | 900000  |
---------------------------------------------------------------
| bufferMax     | maximum number of buffered messages kept by peer | 1000  |
---------------------------------------------------------------
| acknowledgeInterval     | message acknowledge interva (ms)| 1000  |
---------------------------------------------------------------
| maxPeers     | message acknowledge interva (ms)| 1000  |
---------------------------------------------------------------

## Make it listen

```javascript
node.listen(port);
```

## Connect to another node in another process

```javascript
node.connect(port, host);
```

## Emit events on a node

```javascript
node.emit('event', 'a', 1);
```

## Receive events

```javascript
node.on('event', function() {
  console.log('got event:', arguments);
});
```
