'use strict'

var debug = require('debug')('flunky-services:kademlia:transport')
var inherits = require('inherits')
var kademlia = require('kad')
var crypto = require('crypto')

/* KADEMLIA CONTACT */

var getNodeIdFromPublicKey = function (publicKey) {
  var pubhash = crypto.createHash('sha256').update(publicKey).digest()
  var pubripe = crypto.createHash('rmd160').update(pubhash).digest()
  return pubripe.toString('hex')
}

var FlunkyContact = function (options) {
  debug('initialize FlunkyContact')
  debug(options)
  if (!(this instanceof FlunkyContact)) {
    return new FlunkyContact(options)
  }
  this.connectionInfo = options
  kademlia.Contact.call(this, options)
}

inherits(FlunkyContact, kademlia.Contact)

FlunkyContact.prototype._createNodeID = function () {
  return getNodeIdFromPublicKey(this.connectionInfo.signId)
}

FlunkyContact.prototype.toString = function () {
  return this.connectionInfo.signId
}

/* KADEMLIA TRANSPORT */

var FlunkyTransport = function (contact, options) {
  debug('initialize FlunkyTransport')
  this.messaging = options.messaging
  kademlia.RPC.call(this, contact, options)
}

inherits(FlunkyTransport, kademlia.RPC)

FlunkyTransport.prototype._open = function (ready) {
  this.messaging.on('self.kademlia', this._onMessage.bind(this))
  this.messaging.on('friends.kademlia', this._onMessage.bind(this))
  this.messaging.on('public.kademlia', this._onMessage.bind(this))
  setImmediate(function () {
    ready()
  })
}

FlunkyTransport.prototype._onMessage = function (topic, publicKey, data) {
  debug('_onMessage')
  data = new Buffer(JSON.stringify(data), 'utf8')
  this.receive(data)
}

FlunkyTransport.prototype._send = function (data, contact) {
  debug('_send')
  data = JSON.parse(data.toString('utf8'))
  debug(data)
  debug(contact)
  this.messaging.send('kademlia', contact.connectionInfo.signId, data, {realtime: true, expireAfter: 10000})
}

FlunkyTransport.prototype._close = function () {}

FlunkyTransport.prototype._createContact = function (options) {
  debug('_createContact')
  debug(options)
  this.messaging.send('transports.connectionInfo', 'local', options.connectionInfo)
  return new this._contact.constructor(options.connectionInfo)
}

module.exports = {
  FlunkyTransport: FlunkyTransport,
  FlunkyContact: FlunkyContact
}
