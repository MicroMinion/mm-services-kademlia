# mm-services-kademlia

DHT to store connection information for remote peers and act as generic key/value store

works with [MicroMinion platform](https://github.com/MicroMinion/mm-platform)

## Initialization

```js
var MicroMinionPlatform = require('mm-platform')
var Kademlia = require('mm-services-kademlia')
var kadfs = require('kad-fs')
var path = require('path')

var storageDir = './data'

var platform = new MicroMinionPlatform({
  storage: kadfs(path.join(storageDir, 'platform'))
})

var kademlia = new Kademlia({
  platform: platform,
  storage: kadfs(path.join(storageDir, 'dht'))
  seeds: null //Extra seeds
})
```
## Messaging API

### Data structures

#### nodeInfo: Javascript object with node information

* **boxId**: base64 encoded public encryption key used by [nacl](https://github.com/dchest/tweetnacl-js#public-key-authenticated-encryption-box)
* **signId**: base64 encoded public signature key used by [nacl](https://github.com/dchest/tweetnacl-js#signatures)
* **connectionInfo**: javascript dictionary with [1tp](https://github.com/MicroMinion/1tp) connection information

### Published messages

#### self.transports.nodeInfo

Publishes connection information for remote node

```js
var MicroMinionPlatform = require('mm-platform')
var Kademlia = require('mm-services-kademlia')
var kadfs = require('kad-fs')
var path = require('path')

var storageDir = './data'

var platform = new MicroMinionPlatform({
  storage: kadfs(path.join(storageDir, 'platform'))
})

var kademlia = new Kademlia({
  platform: platform,
  storage: kadfs(path.join(storageDir, 'dht'))
  seeds: null //Extra seeds
})

platform.messaging.on('self.transports.nodeInfo', function(topic, sender, nodeInfo) {
  console.log(topic) // 'self.transports.nodeInfo'
  console.log(sender) // 'local'
  console.log(nodeInfo) // {boxId: <boxId>, signId: <signId>, connectionInfo: <1tp connectionInfo>}
})
```
#### self.transports.requestBootstrapNodeInfo

Requests bootstrap nodes in order to start DHT (in addition to potential seed nodes)
```js
var MicroMinionPlatform = require('mm-platform')
var Kademlia = require('mm-services-kademlia')
var kadfs = require('kad-fs')
var path = require('path')

var storageDir = './data'

var platform = new MicroMinionPlatform({
  storage: kadfs(path.join(storageDir, 'platform'))
})

var kademlia = new Kademlia({
  platform: platform,
  storage: kadfs(path.join(storageDir, 'dht'))
  seeds: null //Extra seeds
})

//local nodeInfo. This method is used for sending remote nodeInfo
var nodeInfo = {
  boxId: platform.directory.identity.getBoxId()
  signId: platform.directory.identity.getSignId()
  connectionInfo: platform.directory._connectionInfo
}

platform.messaging.on('self.transports.requestBootstrapNodeInfo', function(topic, sender, data) {
  platform.messaging.send('transports.nodeInfoBootstrap', 'local', nodeInfo)
})
```

#### self.directory.getReply

Reply to previously received get message

```js
var MicroMinionPlatform = require('mm-platform')
var Kademlia = require('mm-services-kademlia')
var kadfs = require('kad-fs')
var path = require('path')

var storageDir = './data'

var platform = new MicroMinionPlatform({
  storage: kadfs(path.join(storageDir, 'platform'))
})

var kademlia = new Kademlia({
  platform: platform,
  storage: kadfs(path.join(storageDir, 'dht'))
  seeds: null //Extra seeds
})

platform.messaging.on('self.directory.getReply', function(topic, sender, getReply) {
  console.log(getReply.key)
  console.log(getReply.value)
})

platform.messaging.send('directory.get', 'local', 'KeyToRetrieve')
```

### Subscribed messages

#### self.transports.myNodeInfo

Uses our own node information to add to DHT

You'll never need to send this message since this is triggered from the platform object

```js
var MicroMinionPlatform = require('mm-platform')
var Kademlia = require('mm-services-kademlia')
var kadfs = require('kad-fs')
var path = require('path')

var storageDir = './data'

var platform = new MicroMinionPlatform({
  storage: kadfs(path.join(storageDir, 'platform'))
})

var kademlia = new Kademlia({
  platform: platform,
  storage: kadfs(path.join(storageDir, 'dht'))
  seeds: null //Extra seeds
})

var nodeInfo = {
  boxId: platform.directory.identity.getBoxId()
  signId: platform.directory.identity.getSignId()
  connectionInfo: platform.directory._connectionInfo
}

platform.messaging.send('transports.myNodeInfo', 'local', nodeInfo)
```

#### self.transports.nodeInfoBootstrap

Bootstrap messages with nodeInfo (to allow DHT to function even if not connected to the Internet by using e.g., other nodes on local network to form DHT).

```js
var MicroMinionPlatform = require('mm-platform')
var Kademlia = require('mm-services-kademlia')
var kadfs = require('kad-fs')
var path = require('path')

var storageDir = './data'

var platform = new MicroMinionPlatform({
  storage: kadfs(path.join(storageDir, 'platform'))
})

var kademlia = new Kademlia({
  platform: platform,
  storage: kadfs(path.join(storageDir, 'dht'))
  seeds: null //Extra seeds
})

//local nodeInfo. This method is used for sending remote nodeInfo
var nodeInfo = {
  boxId: platform.directory.identity.getBoxId()
  signId: platform.directory.identity.getSignId()
  connectionInfo: platform.directory._connectionInfo
}

platform.messaging.on('self.transports.requestBootstrapNodeInfo', function(topic, sender, data) {
  platform.messaging.send('transports.nodeInfoBootstrap', 'local', nodeInfo)
})
```

#### self.transports.requestNodeInfo

Requests node info from directory services (like DHT)
```js
var MicroMinionPlatform = require('mm-platform')
var Kademlia = require('mm-services-kademlia')
var kadfs = require('kad-fs')
var path = require('path')

var storageDir = './data'

var platform = new MicroMinionPlatform({
  storage: kadfs(path.join(storageDir, 'platform'))
})

var kademlia = new Kademlia({
  platform: platform,
  storage: kadfs(path.join(storageDir, 'dht'))
  seeds: null //Extra seeds
})

platform.messaging.on('self.transports.nodeInfo', function(topic, sender, nodeInfo) {
  console.log(topic) // 'self.transports.nodeInfo'
  console.log(sender) // 'local'
  console.log(nodeInfo) // nodeInfo object
})

var signId = 'NeedToImplement' //signId (base64 encoded) for node where we want to get full nodeInfo

platform.messaging.send('transports.requestNodeInfo', 'local', signId)
```

#### self.directory.get

get key/value pair from DHT
```js
var MicroMinionPlatform = require('mm-platform')
var Kademlia = require('mm-services-kademlia')
var kadfs = require('kad-fs')
var path = require('path')

var storageDir = './data'

var platform = new MicroMinionPlatform({
  storage: kadfs(path.join(storageDir, 'platform'))
})

var kademlia = new Kademlia({
  platform: platform,
  storage: kadfs(path.join(storageDir, 'dht'))
  seeds: null //Extra seeds
})

platform.messaging.on('self.directory.getReply', function(topic, sender, getReply) {
  console.log(getReply.key)
  console.log(getReply.value)
})

platform.messaging.send('directory.get', 'local', 'KeyToRetrieve')
```

#### self.directory.put

add key/value pair to DHT
```js
var MicroMinionPlatform = require('mm-platform')
var Kademlia = require('mm-services-kademlia')
var kadfs = require('kad-fs')
var path = require('path')

var storageDir = './data'

var platform = new MicroMinionPlatform({
  storage: kadfs(path.join(storageDir, 'platform'))
})

var kademlia = new Kademlia({
  platform: platform,
  storage: kadfs(path.join(storageDir, 'dht'))
  seeds: null //Extra seeds
})

platform.messaging.send('directory.put', 'local', {key: 'KeyToRetrieve', value: 'ValueToRetrieve'})
```
