'use strict'
var async = require('async')
var MemStore = require('kad-memstore-thomas')
var Bucket = require('./bucket')
var assert = require('assert')
var _ = require('lodash')

var RoutingTable = function (storage, rpc) {
  assert(_.isObject(storage), 'storage parameter is not an object')
  assert(_.isObject(rpc), 'rpc parameter is not an object')
  if (!storage) {
    storage = new MemStore()
  }
  this._validStorageAdapter(storage)
  this._storage = storage
  this._rpc = rpc
}

RoutingTable.prototype._load = function (callback) {
  assert(_.isFunction(callback), '_load callback is not a function')
  var self = this
  if (this._buckets) {
    async.setImmediate(function () {
      callback()
    })
    return
  }
  if (this._loadingCallbacks) {
    this._loadingCallbacks.push(callback)
    return
  }
  this._loadingCallbacks = []
  this._loadingCallbacks.push(callback)
  this._storage.get('ROUTING-TABLE', function (err, result) {
    try {
      result = JSON.parse(result)
      _.forEach(result, function (contacts, index) {
        self._buckets[index] = new Bucket(index, self)
      })
    } catch (e) {
      self._buckets = {}
    }
    _.forEach(self._loadingCallbacks, function (cb) {
      async.setImmediate(function () {
        cb()
      })
    })
    delete self._loadingCallbacks
  })
}

RoutingTable.prototype.save = function (callback) {
  assert(_.isFunction(callback), 'save callback is not a function')
  var result = {}
  _.forEach(this._buckets, function (bucket, index) {
    result[index] = bucket.contacts
  })
  this._storage.put('ROUTING-TABLE', JSON.stringify(result), callback)
}

RoutingTable.prototype.getSize = function (callback) {
  assert(_.isFunction(callback), 'getSize callback is not a function')
  var self = this
  this._load(function () {
    var size = 0
    _.forEach(self._buckets, function (bucket) {
      size += bucket.getSize()
    })
    callback(null, size)
  })
}

RoutingTable.prototype.getIndexes = function (callback) {
  assert(_.isFunction(callback), 'getIndexes callback is not a function')
  var self = this
  this._load(function () {
    callback(null, _.keys(self._buckets))
  })
}

RoutingTable.prototype.empty = function (callback) {
  assert(_.isUndefined(callback) || _.isFunction(callback), 'invalid callback argument for empty()')
  if (!callback) {
    callback = function () {}
  }
  this._buckets = {}
  this.save(callback)
}

RoutingTable.prototype.getBucket = function (index, callback) {
  assert(_.isNumber(index) && index >= 0, 'invalid index argument')
  assert(_.isFunction(callback), 'getBucket needs callback argument')
  var self = this
  async.waterfall([
    self._load.bind(self),
    function (cb) {
      assert(_.isFunction(cb), 'invalid callback')
      if (!_.has(self._buckets, index)) {
        self._buckets[index] = new Bucket(index, self)
        self.save(function () {
          cb(null, self._buckets[index])
        })
      } else {
        cb(null, self._buckets[index])
      }
    }
  ], callback)
}

RoutingTable.prototype.hasBucket = function (index, callback) {
  assert(_.isNumber(index) && index >= 0, 'invalid index argument')
  assert(_.isFunction(callback), 'hasBucket needs callback argument')
  var self = this
  self._load(function () {
    if (!_.has(self._buckets, index) || self._buckets[index].length === 0) {
      callback(new Error('Bucket does not exist yet'))
    } else {
      callback()
    }
  })
}

RoutingTable.prototype.getContact = function (nodeID, callback) {
  assert(_.isString(nodeID), 'nodeID needs to be string')
  assert(_.isFunction(callback), 'getContact needs callback argument')
  var self = this
  this._storage.get(nodeID, function (err, result) {
    if (err) {
      callback(err, null)
    } else {
      try {
        var contact = self._rpc._createContact(JSON.parse(result))
        callback(null, contact)
      } catch (e) {
        callback(e)
      }
    }
  })
}

RoutingTable.prototype.setContact = function (contact, callback) {
  assert(_.isObject(contact), 'contact needs to be object')
  assert(_.isFunction(callback), 'setContact needs callback argument')
  this._storage.put(contact.nodeID, JSON.stringify(contact), callback)
}

RoutingTable.prototype.inTable = function (contact, callback) {
  assert(_.isObject(contact), 'contact needs to be object')
  assert(_.isFunction(callback), 'inTable needs callback argument')
  var self = this
  this._load(function () {
    var result = _.some(self._buckets, function (bucket) {
      return bucket.hasContact(contact.nodeID)
    })
    if (result) {
      callback()
    } else {
      callback(new Error('Contact not found in routing table'))
    }
  })
}

/**
 * Validates the set storage adapter
 * @private
 * @param {Object} storage
 */
RoutingTable.prototype._validStorageAdapter = function (storage) {
  assert(typeof storage === 'object', 'No storage adapter supplied')
  assert(typeof storage.get === 'function', 'Store has no get method')
  assert(typeof storage.put === 'function', 'Store has no put method')
  assert(typeof storage.del === 'function', 'Store has no del method')
  assert(
    typeof storage.createReadStream === 'function',
    'Store has no createReadStream method'
  )
}

module.exports = RoutingTable
