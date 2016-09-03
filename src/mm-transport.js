'use strict'

var inherits = require('inherits')
var kademlia = require('kad-js')
var crypto = require('crypto')
var ms = require('ms')
var assert = require('assert')
var _ = require('lodash')

var RESPONSE_TIMEOUT = ms('5s')

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

MMTransport.prototype.open = function (callback) {
  var self = this

  if (callback) {
    self.once('ready', callback)
  }

  self.readyState = 1

  self._trigger('before:open', [], function () {
    self._open(function () {
      self.readyState = 2
      self.emit('ready')
      self._trigger('after:open')
    })
  })
}

MMTransport.prototype._open = function (ready) {
  this.messaging.on('self.kademlia', this._onMessage.bind(this))
  this.messaging.on('friends.kademlia', this._onMessage.bind(this))
  this.messaging.on('public.kademlia', this._onMessage.bind(this))
  setImmediate(function () {
    ready()
  })
}

MMTransport.prototype._onMessage = function (topic, publicKey, data) {
  if(_.has(data, 'result')) {
    data.result.__receivingBoxId = publicKey
  } else if(_.has(data, 'params')) {
    data.params.__receivingBoxId = publicKey
  }
  data = new Buffer(JSON.stringify(data), 'utf8')
  this.receive(data)
}

MMTransport.prototype.send = function (contact, message, callback) {
  var self = this

  contact = this._createContact(contact)

  assert(contact instanceof kademlia.Contact, 'Invalid contact supplied')
  assert(message instanceof kademlia.Message, 'Invalid message supplied')

  if (kademlia.Message.isRequest(message)) {
    this._log.info('sending %s message to %j', message.method, contact)
  } else {
    this._log.info('replying to message to %s', message.id)
  }

  this._trigger('before:serialize', [message], function () {
    var serialized = message.serialize()

    self._trigger('after:serialize')
    self._trigger('before:send', [serialized, contact], function () {
      if (kademlia.Message.isRequest(message) && typeof callback === 'function') {
        self._log.debug('queuing callback for reponse to %s', message.id)

        self._pendingCalls[message.id] = {
          timestamp: Date.now(),
          callback: callback,
          contact: contact,
          message: message
        }
      } else {
        self._log.debug('not waiting on callback for message %s', message.id)
      }

      self._send(message.serialize(), contact, function (err) {
        if (err) {
          self._log.warn('rpc call %s could not be send', message.id)
          if (callback) {
            callback(new Error('RPC with ID `' + message.id + '` could not be send'))
          }
          delete self._pendingCalls[message.id]
        }
      })
      self._trigger('after:send')
    })
  })
}

MMTransport.prototype._send = function (data, contact, callback) {
  data = JSON.parse(data.toString('utf8'))
  this.messaging.send('kademlia', contact.nodeInfo.boxId, data, {
    realtime: true,
    expireAfter: RESPONSE_TIMEOUT,
    callback: callback
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
