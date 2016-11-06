/**
 * @class kad-telemetry/metrics/reliability
 */

'use strict'

var Message = require('../../kad/index.js').Message
var inherits = require('util').inherits
var Metric = require('../metric')

/**
 * Defines a metric that measures reliability by success/error responses
 * @constructor
 */
function ReliabilityMetric () {
  if (!(this instanceof ReliabilityMetric)) {
    return new ReliabilityMetric()
  }

  Metric.call(this)

  this.key = 'reliability'
  this.default = [0, 0] // [success,error]
  this.hooks = [{
    trigger: 'before',
    event: 'receive',
    handler: this._recordResponseType
  }]
}

inherits(ReliabilityMetric, Metric)

/**
 * Begins the reliability test
 * #_recordResponseType
 * @param {telemetry.metrics.LatencyMetric} self
 * @param {telemetry.Persistence} profiles
 * @returns {Function}
 */
ReliabilityMetric.prototype._recordResponseType = function (self, profiles) {
  return function (message, contact, next) {
    var cb = function (err, profile) {
      var metric = self.getMetric(profile)

      if (Message.isRequest(message)) {
        return next()
      }

      metric[message.error ? 1 : 0]++

      self.setMetric(profile, metric)
      profiles.setProfile(contact, profile, function () {
        next()
      })
    }
    profiles.getProfile(contact, cb)
  }
}

/**
 * Returns the score for a given metric value
 * #score
 * @param {Array} value
 * @returns {Number}
 */
ReliabilityMetric.score = function (value) {
  return value[0] / (value[0] + value[1])
}

module.exports = ReliabilityMetric
