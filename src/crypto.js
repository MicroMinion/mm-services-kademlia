'use strict'

/**
 * @module kad-spartacus/hooks
 */

var kademlia = require('kad-js')
var nacl = require('tweetnacl')
nacl.util = require('tweetnacl-util')

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

/**
 * Used as a transport.before('receive') hook
 * #verify
 * @param {Object} keypair
 */
module.exports.verify = function (message, contact, next) {
  var signature
  var nonce
  if (kademlia.Message.isRequest(message)) {
    signature = message.params.__signature
    delete message.params.__signature
    nonce = message.params.__nonce
  } else {
    signature = message.result.__signature
    delete message.result.__signature
    nonce = message.result.__nonce
  }
  if (Date.now() > (module.exports.NONCE_EXPIRE + nonce)) {
    next(new Error('Message signature expired'))
    return
  }
  var contract = nacl.hash(new Uint8Array(new Buffer(JSON.stringify(message))))
  signature = new Buffer(signature, 'hex')
  var signId = nacl.util.decodeBase64(contact.nodeInfo.signId)
  if (nacl.sign.detached.verify(contract, signature, signId)) {
    next()
  } else {
    next(new Error('Signature verification failed'))
  }
}
