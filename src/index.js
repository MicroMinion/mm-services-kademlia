'use strict'

var kademlia = require('kad')
var debug = require('debug')('mm-services:kademlia')
var MMTransport = require('./mm-transport.js').MMTransport
var MMContact = require('./mm-transport.js').MMContact
var crypto = require('./crypto.js')
// var telemetry = require('kad-telemetry')

var _ = require('lodash')

var seeds = {}

var KademliaService = function (options) {
  debug('initialize')
  this.messaging = options.platform.messaging
  this.storage = options.storage
  this.myNodeInfo = {}
  this.online = false
  var self = this
  this.messaging.on('self.transports.myNodeInfo', this._updateNodeInfo.bind(this))
  options.platform.on('ready', function () {
    self.keypair = options.platform.identity.sign
  })
}

KademliaService.prototype._updateNodeInfo = function (topic, publicKey, data) {
  debug('_updateNodeInfo')
  this.myNodeInfo = data
  if (!this.dht) {
    this._setup()
  } else {
    this.contact.nodeInfo = this.myNodeInfo
    this.put('self.directory.put', 'local', {
      key: data.boxId,
      value: data.signId
    })
  }
}

KademliaService.prototype._setup = function () {
  debug('_setup')
  this.messaging.on('self.directory.get', this.get.bind(this))
  this.messaging.on('self.directory.put', this.put.bind(this))
  this.messaging.on('self.transports.nodeInfoBootstrap', this.connect.bind(this))
  this.messaging.on('self.transports.requestNodeInfo', this.requestNodeInfo.bind(this))
  this.contact = new MMContact(this.myNodeInfo)
  // var TelemetryTransport = telemetry.TransportDecorator(MMTransport)
  // var pathToTelemetryData = null
  // var transport = new TelemetryTransport(contact, {messaging: this.messaging, telemetry: {filename: pathToTelemetryData}})
  var transport = new MMTransport(this.contact, {
    messaging: this.messaging
  })
  transport.before('serialize', crypto.sign.bind(null, this.keypair))
  transport.before('receive', crypto.verify)
  // var TelemetryRouter = telemetry.RouterDecorator(kademlia.Router)
  // var router = new TelemetryRouter({
  //  transport: transport
  // })
  this.dht = new kademlia.Node({
    storage: this.storage,
    transport: transport
  })
  this.dht._log.level = 3
  var service = this
  this.dht.once('connect', function () {
    service.online = true
  })
  this._setupSeeds()
  this.messaging.send('transports.requestBootstrapNodeInfo', 'local', {})
}

KademliaService.prototype.connect = function (topic, publicKey, data) {
  debug('connect')
  debug(data)
  if (data.signId !== this.myNodeInfo.signId) {
    this.dht.connect(new MMContact(data))
  }
}

KademliaService.prototype.requestNodeInfo = function (topic, publicKey, data) {
  debug('requestNodeInfo')
  debug(data)
  var signId = data
  var buckets = this.dht._router._buckets
  _.forEach(buckets, function (bucket) {
    _.forEach(bucket._contacts, function (contact) {
      if (contact.nodeInfo.signId === signId) {
        debug(contact.nodeInfo)
        this.messaging.send('transports.nodeInfo', 'local', contact.nodeInfo)
      }
    }, this)
  }, this)
}

KademliaService.prototype.get = function (topic, publicKey, data) {
  debug('get')
  var self = this
  if (!this.online) {
    debug('kad server not ready to retrieve values')
    return
  }
  this.dht.get(data.key, function (err, dataObject) {
    if (err) {
      debug('kad server failed retrieving value for ' + data.key + '. ' + err)
      return
    }
    self.messaging.send('directory.getReply', 'local', {
      key: data.key,
      value: dataObject.value
    })
  })
}

KademliaService.prototype.put = function (topic, publicKey, data) {
  debug('put')
  if (!this.online) {
    debug('kad server not ready to store KV tuples')
    return
  }
  if (this.online) {
    var dataObject = data.value
    debug('kad server storing [' + data.key + ',' + JSON.stringify(dataObject) + '].')
    this.dht.put(data.key, dataObject, function (error) {
      if (error) {
        debug('kad server failed storing [' + data.key + ',' + dataObject + ']. ' + error)
      } else {
        debug('kad server stored [' + data.key + ',' + dataObject + ']. ')
      }
    })
  }
}

KademliaService.prototype._setupSeeds = function () {
  debug('_setupSeeds')
  _.forEach(seeds, function (nodeInfo) {
    this._setupSeed(nodeInfo)
  }, this)
}

KademliaService.prototype._setupSeed = function (nodeInfo) {
  debug('_setupSeed')
  debug(nodeInfo)
  var self = this
  this.messaging.send('transports.nodeInfo', 'local', nodeInfo)
  setImmediate(function () {
    self.dht.connect(new MMContact(nodeInfo))
  })
}

module.exports = KademliaService
