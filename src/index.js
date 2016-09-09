'use strict'

var kademlia = require('kad-js')
var MMTransport = require('./mm-transport.js').MMTransport
var MMContact = require('./mm-transport.js').MMContact
var crypto = require('./crypto.js')
var winston = require('winston')
var winstonWrapper = require('winston-meta-wrapper')
var extend = require('extend.js')
var telemetry = require('kad-telemetry-js')
var async = require('async')
var _ = require('lodash')

//var seeds = require('./bootstrap-nodes.js')
var seeds = []

var EXPIRE_TRESHOLD = 2 * 1000 * 60

var KademliaService = function (options) {
  var self = this
  this._options = options
  if (!options.logger) {
    this._options.logger = winston
  }
  if (!options.seeds) {
    options.seeds = seeds
  }
  this.seeds = options.seeds
  this.messaging = options.platform.messaging
  this.platform = options.platform
  this.storage = options.storage
  this.directoryStorage = options.directoryStorage
  this.telemetryStorage = options.telemetryStorage
  this.myNodeInfo = {}
  this._log = winstonWrapper(this._options.logger)
  this._log.addMeta({
    module: 'mm-kademlia-service'
  })
  this.messaging.on('self.transports.myNodeInfo', this._updateNodeInfo.bind(this))
  if (options.platform.isReady()) {
    self.keypair = options.platform.identity.sign
    this.messaging.send('transports.requestMyNodeInfo', 'local', {})
  } else {
    options.platform.on('ready', function () {
      self.keypair = options.platform.identity.sign
    })
  }
}

KademliaService.prototype._updateNodeInfo = function (topic, publicKey, data) {
  this.myNodeInfo = data
  if (!this.dht) {
    this._setup()
  } else {
    this.contact.nodeInfo = this.myNodeInfo
  }
}

KademliaService.prototype._setup = function () {
  this._log.debug('_setup')
  this.messaging.on('self.directory.get', this.get.bind(this))
  this.messaging.on('self.directory.put', this.put.bind(this))
  this.messaging.on('self.transports.nodeInfoBootstrap', this.connect.bind(this))
  this.messaging.on('self.transports.requestNodeInfo', this.requestNodeInfo.bind(this))
  this.contact = new MMContact(this.myNodeInfo)
  var kademliaLogger = winstonWrapper(this._log)
  kademliaLogger.addMeta({
    module: 'kad'
  })
  var TelemetryTransport = telemetry.TransportDecorator(MMTransport)
  var transport = new TelemetryTransport(this.contact, {
    messaging: this.messaging,
    telemetry: { storage: this.telemetryStorage }
  })
  transport.before('serialize', crypto.sign.bind(null, this.keypair))
  transport.before('receive', crypto.verify)
  transport.on('error', function(err) {
    kademliaLogger.warn('RPC error raised, reason: %s', err.message)
  })
  var TelemetryRouter = telemetry.RouterDecorator(kademlia.Router)
  var router = new TelemetryRouter({
    transport: transport,
    logger: kademliaLogger,
    storage: this.directoryStorage
  })
  this._router = router
  this.dht = new kademlia.Node({
    storage: this.storage,
    transport: transport,
    logger: kademliaLogger,
    router: router
  })
  var service = this
  this.dht.once('join', function () {
    service._updateNodeInfo(null, null, service.myNodeInfo)
  })
  this._setupSeeds()
  this.messaging.send('transports.requestBootstrapNodeInfo', 'local', {})
}

KademliaService.prototype.connect = function (topic, publicKey, data) {
  if (data.boxId !== this.myNodeInfo.boxId) {
    this._log.debug('connecting to node', {
      nodeInfo: data
    })
    this.dht.connect(new MMContact(data))
  }
}

KademliaService.prototype.requestNodeInfo = function (topic, publicKey, data) {
  var self = this
  var boxId = data
  var contact = new MMContact({boxId: boxId})
  this._router.getContactByNodeID(contact.nodeID, function (err, result) {
    if (err) {
      self._log.warn('Contact  ' + boxId + ' not found')
    } else {
      self.messaging.send('transport.nodeInfo', 'local', result.nodeInfo)
      if(result.nodeInfo.expireTime && result.nodeInfo.expireTime + EXPIRE_TRESHOLD > Date.now()) {
        self.dht.ping(result)
      }
    }
  })
}

KademliaService.prototype.get = function (topic, publicKey, key) {
  this._log.info('retrieving value', {
    key: key
  })
  var self = this
  if (!this.dht.connected) {
    this._log.warn('kad server not ready to retrieve values')
    return
  }
  this.dht.get(key, function (err, value) {
    if (err || value === undefined) {
      self._log.warn('kad server failed retrieving value', {
        key: key,
        error: err
      })
      return
    }
    self.messaging.send('directory.getReply', 'local', {
      key: key,
      value: value
    })
  })
}

KademliaService.prototype.put = function (topic, publicKey, data) {
  this._log.info('storing value', data)
  var self = this
  if (!this.dht.connected) {
    this._log.warn('kad server not ready to store values', data)
    return
  }
  if (this.dht.connected) {
    var dataObject = data.value
    this.dht.put(data.key, dataObject, function (error) {
      if (error) {
        self._log.warn('kad server failed storing value', extend(data, {
          error: error
        }))
      } else {
        self._log.info('kad server stored value', data)
      }
    })
  }
}

KademliaService.prototype._setupSeeds = function () {
  var self = this
  _.forEach(this.seeds, function (nodeInfo) {
    self._setupSeed(nodeInfo)
  })
}

KademliaService.prototype._setupSeed = function (nodeInfo) {
  this._log.debug('connecting to seed', nodeInfo)
  var self = this
  this.messaging.send('transports.nodeInfo', 'local', nodeInfo)
  async.setImmediate(function () {
    self.dht.connect(new MMContact(nodeInfo))
  })
}

module.exports = KademliaService
