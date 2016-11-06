/**
 * @class kad-telemetry/persistence
 */

'use strict'

var assert = require('assert')
var Profile = require('./profile')
var _ = require('lodash')

/**
 * Represents a persisted dataset of `Profile`s
 * @constructor
 * @param {String} filename
 */
function Persistence (storage) {
  if (!(this instanceof Persistence)) {
    return new Persistence(storage)
  }
  this._setStorageAdapter(storage)
  this._cache = {}
}

/**
 * Returns the profile at the given nodeID or an empty profile
 * #getProfile
 * @param {kad.Contact} contact
 * @returns {telemetry.Profile}
 */
Persistence.prototype.getProfile = function (contact, callback) {
  var self = this
  if (_.has(this._cache, contact.nodeID)) {
    callback(null, this._cache[contact.nodeID])
  } else {
    this._getProfile(contact, function (err, result) {
      self._cache[contact.nodeID] = result
      callback(null, result)
    })
  }
}

Persistence.prototype._getProfile = function (contact, callback) {
  this._storage.get(contact.nodeID, function (err, result) {
    if (err) {
      callback(null, new Profile())
    } else {
      callback(null, new Profile(JSON.parse(result)))
    }
  })
}

/**
 * Updates the profile at the given nodeID and saves
 * #setProfile
 * @param {kad.Contact} contact
 * @param {telemetry.Profile} profile
 */
Persistence.prototype.setProfile = function (contact, profile, cb) {
  this._cache[contact.nodeID] = profile
  this._setProfile(contact, profile, cb)
}

Persistence.prototype._setProfile = function (contact, profile, cb) {
  assert(profile instanceof Profile, 'Invalid profile supplied')
  this._storage.put(contact.nodeID, JSON.stringify(profile), cb)
}

/**
 * Validates the set storage adapter
 * @private
 * @param {Object} storage
 */
Persistence.prototype._setStorageAdapter = function (storage) {
  assert(typeof storage === 'object', 'No storage adapter supplied')
  assert(typeof storage.get === 'function', 'Store has no get method')
  assert(typeof storage.put === 'function', 'Store has no put method')
  assert(typeof storage.del === 'function', 'Store has no del method')
  assert(
    typeof storage.createReadStream === 'function',
    'Store has no createReadStream method'
  )

  this._storage = storage
}

module.exports = Persistence
