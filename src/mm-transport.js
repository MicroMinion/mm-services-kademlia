'use strict'

var inherits = require('inherits')
var kademlia = require('kad')
var crypto = require('crypto')

/* KADEMLIA CONTACT */

var getNodeIdFromPublicKey = function (publicKey) {
  var pubhash = crypto.createHash('sha256').update(publicKey).digest()
  var pubripe = crypto.createHash('rmd160').update(pubhash).digest()
  return pubripe.toString('hex')
}

var MMContact = function (options) {
  if (!(this instanceof MMContact)) {
    return new MMContact(options)
  }
  this.nodeInfo = options
  kademlia.Contact.call(this, options)
}

inherits(MMContact, kademlia.Contact)

MMContact.prototype._createNodeID = function () {
  return getNodeIdFromPublicKey(this.nodeInfo.boxId)
}

MMContact.prototype.toString = function () {
  return this.nodeInfo.boxId
}

/* KADEMLIA TRANSPORT */

var MMTransport = function (contact, options) {
  this.messaging = options.messaging
  kademlia.RPC.call(this, contact, options)
}

inherits(MMTransport, kademlia.RPC)

MMTransport.prototype._open = function (ready) {
  this.messaging.on('self.kademlia', this._onMessage.bind(this))
  this.messaging.on('friends.kademlia', this._onMessage.bind(this))
  this.messaging.on('public.kademlia', this._onMessage.bind(this))
  setImmediate(function () {
    ready()
  })
}

MMTransport.prototype._onMessage = function (topic, publicKey, data) {
  data = new Buffer(JSON.stringify(data), 'utf8')
  this.receive(data)
}

MMTransport.prototype._send = function (data, contact) {
  data = JSON.parse(data.toString('utf8'))
  this.messaging.send('kademlia', contact.nodeInfo.boxId, data, {
    realtime: true,
    expireAfter: 10000
  })
}

MMTransport.prototype._close = function () {}

MMTransport.prototype._createContact = function (options) {
  this.messaging.send('transports.nodeInfo', 'local', options.nodeInfo)
  return new this._contact.constructor(options.nodeInfo)
}

module.exports = {
  MMTransport: MMTransport,
  MMContact: MMContact
}
