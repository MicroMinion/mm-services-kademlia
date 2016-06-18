'use strict'

var kademlia = require('kad')
var debug = require('debug')('flunky-services:kademlia')
var FlunkyTransport = require('./flunky-transport.js').FlunkyTransport
var FlunkyContact = require('./flunky-transport.js').FlunkyContact
var crypto = require('./crypto.js')
var telemetry = require('kad-telemetry')

var _ = require('lodash')

var seeds = {}

var KademliaService = function (options) {
  debug('initialize')
  this.messaging = options.platform.messaging
  this.storage = options.storage
  this.myConnectionInfo = {}
  this.online = false
  var self = this
  this.messaging.on('self.transports.myConnectionInfo', this._updateConnectionInfo.bind(this))
  options.platform.on('ready', function () {
    self.keypair = options.platform.identity.sign
  })
}

KademliaService.prototype._updateConnectionInfo = function (topic, publicKey, data) {
  debug('_updateConnectionInfo')
  this.myConnectionInfo = data
  if (!this.dht) {
    this._setup()
  } else {
    this.contact.connectionInfo = this.myConnectionInfo
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
  this.messaging.on('self.transports.connectionInfoBootstrap', this.connect.bind(this))
  this.messaging.on('self.transports.requestConnectionInfo', this.requestConnectionInfo.bind(this))
  this.contact = new FlunkyContact(this.myConnectionInfo)
  // var TelemetryTransport = telemetry.TransportDecorator(FlunkyTransport)
  // var pathToTelemetryData = null
  // var transport = new TelemetryTransport(contact, {messaging: this.messaging, telemetry: {filename: pathToTelemetryData}})
  var transport = new FlunkyTransport(this.contact, {
    messaging: this.messaging
  })
  transport.before('serialize', crypto.sign.bind(null, this.keypair))
  transport.before('receive', crypto.verify)
  var TelemetryRouter = telemetry.RouterDecorator(kademlia.Router)
  var router = new TelemetryRouter({
    transport: transport
  })
  this.dht = new kademlia.Node({
    storage: this.storage,
    transport: transport,
    router: router
  })
  var service = this
  this.dht.once('connect', function () {
    service.online = true
  })
  this._setupSeeds()
  this.messaging.send('transports.requestBootstrapConnectionInfo', 'local', {})
}

KademliaService.prototype.connect = function (topic, publicKey, data) {
  debug('connect')
  debug(data)
  if (data.signId !== this.myConnectionInfo.signId) {
    this.dht.connect(new FlunkyContact(data))
  }
}

KademliaService.prototype.requestConnectionInfo = function (topic, publicKey, data) {
  debug('requestConnectionInfo')
  debug(data)
  var signId = data
  var buckets = this.dht._router._buckets
  _.forEach(buckets, function (bucket) {
    _.forEach(bucket._contacts, function (contact) {
      if (contact.connectionInfo.signId === signId) {
        debug(contact.connectionInfo)
        this.messaging.send('transports.connectionInfo', 'local', contact.connectionInfo)
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
  _.forEach(seeds, function (connectionInfo) {
    this._setupSeed(connectionInfo)
  }, this)
}

KademliaService.prototype._setupSeed = function (connectionInfo) {
  debug('_setupSeed')
  debug(connectionInfo)
  var self = this
  this.messaging.send('transports.connectionInfo', 'local', connectionInfo)
  setImmediate(function () {
    self.dht.connect(new FlunkyContact(connectionInfo))
  })
}

module.exports = KademliaService
