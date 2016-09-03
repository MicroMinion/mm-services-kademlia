'use strict'

/**
 * @module kad-spartacus/hooks
 */

var kademlia = require('kad-js')
var nacl = require('tweetnacl')
nacl.util = require('tweetnacl-util')
var ed2curve = require('ed2curve')
var crypto = require('crypto')

module.exports.NONCE_EXPIRE = 10000 // 10 seconds

/**
 * Used as a transport.before('serialize') hook
 * #sign
 * @param {Object} keypair
 */
module.exports.sign = function (keypair, message, next) {
  var nonce = Date.now()
  if (kademlia.Message.isRequest(message)) {
    message.params.__nonce = nonce
  } else {
    message.result.__nonce = nonce
  }
  var contract = nacl.hash(new Uint8Array(new Buffer(JSON.stringify(message))))
  var signature = new Buffer(nacl.sign.detached(contract, keypair.secretKey)).toString('hex')
  if (kademlia.Message.isRequest(message)) {
    message.params.__signature = signature
  } else {
    message.result.__signature = signature
  }
  next()
}

var getNodeIdFromPublicKey = function (publicKey) {
  var pubhash = crypto.createHash('sha256').update(publicKey).digest()
  var pubripe = crypto.createHash('rmd160').update(pubhash).digest()
  return pubripe.toString('hex')
}

var nodeIdGeneratedFromBoxId = function(nodeId, boxId) {
  return nodeId === getNodeIdFromPublicKey(boxId)
}

var boxIdGeneratedFromSignId  = function(boxId, signId) {
  boxId = nacl.util.decodeBase64(boxId)
  signId = nacl.util.decodeBase64(signId)
  return _isEqual(ed2curve.convertPublicKey(signId), boxId)
}

var _isEqual = function (a, b) {
  // debug('isEqual')
  if (a.length !== b.length) {
    return false
  }
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

var boxIdMatch = function(connectionBoxId, contactBoxId) {
  return connectionBoxId === contactBoxId
}

/**
 * Used as a transport.before('receive') hook
 * #verify
 * @param {Object} keypair
 */
module.exports.verify = function (message, contact, next) {
  var signature
  var nonce
  var receivingBoxId
  if (kademlia.Message.isRequest(message)) {
    signature = message.params.__signature
    delete message.params.__signature
    nonce = message.params.__nonce
    receivingBoxId = message.params.__receivingBoxId
    delete message.params.__receivingBoxId
  } else {
    signature = message.result.__signature
    delete message.result.__signature
    nonce = message.result.__nonce
    receivingBoxId = message.result.__receivingBoxId
    delete message.result.__receivingBoxId
  }
  if(!nodeIdGeneratedFromBoxId(contact.nodeID, contact.nodeInfo.boxId)) {
    return next(new Error('NodeID not generated from SignID'))
  }
  if(!boxIdGeneratedFromSignId(contact.nodeInfo.boxId, contact.nodeInfo.signId)) {
    return next(new Error('BoxID not generated from SignID'))
  }
  if(!boxIdMatch(receivingBoxId, contact.nodeInfo.boxId)) {
    return next(new Error('BoxID from connection does not match Contact'))
  }
  if (Date.now() > (module.exports.NONCE_EXPIRE + nonce)) {
    return next(new Error('Message signature expired'))
  }
  var contract = nacl.hash(new Uint8Array(new Buffer(JSON.stringify(message))))
  signature = new Buffer(signature, 'hex')
  var signId = nacl.util.decodeBase64(contact.nodeInfo.signId)
  if (nacl.sign.detached.verify(contract, signature, signId)) {
    return next()
  } else {
    return next(new Error('Signature verification failed'))
  }
}
