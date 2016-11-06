/**
 * @class kad-telemetry/metrics/latency
 */

'use strict'

var Message = require('../../kad/index.js').Message
var inherits = require('util').inherits
var Metric = require('../metric')

/**
 * Defines a metric that measures latency by last req/res
 * @constructor
 */
function LatencyMetric () {
  if (!(this instanceof LatencyMetric)) {
    return new LatencyMetric()
  }

  Metric.call(this)

  this.key = 'latency'
  this.default = [0]
  this.hooks = [{
    trigger: 'before',
    event: 'send',
    handler: this._start
  }, {
    trigger: 'before',
    event: 'receive',
    handler: this._stop
  }]

  this._tests = {}

  setInterval(this._expireTimeouts.bind(this), LatencyMetric.TEST_TIMEOUT)
}

inherits(LatencyMetric, Metric)

LatencyMetric.TEST_TIMEOUT = 5000 // 5 seconds

/**
 * Begins the latency test
 * #_start
 * @param {telemetry.metrics.LatencyMetric} self
 * @param {telemetry.Persistence} profiles
 * @returns {Function}
 */
LatencyMetric.prototype._start = function (self) {
  return function (buffer, contact, next) {
    var message = Message.fromBuffer(buffer)

    if (Message.isRequest(message)) {
      self._tests[message.id] = {
        started: Date.now()
      }
    }

    next()
  }
}

/**
 * Ends the latency test
 * #_stop
 * @param {telemetry.metrics.LatencyMetric} self
 * @param {telemetry.Persistence} profiles
 * @returns {Function}
 */
LatencyMetric.prototype._stop = function (self, profiles) {
  return function (message, contact, next) {
    var cb = function (err, profile) {
      if (Message.isRequest(message)) {
        return next()
      }

      var test = self._tests[message.id]

      if (test) {
        self.setMetric(profile, Date.now() - test.started)
        profiles.setProfile(contact, profile, function () {
          next()
        })
      } else {
        next()
      }
    }
    profiles.getProfile(contact, cb)
  }
}

/**
 * Starts an interval of checking for expired tests and cleaning up
 * #_startTestExpiration
 */
LatencyMetric.prototype._expireTimeouts = function () {
  for (var id in this._tests) {
    if (Date.now() > this._tests[id].started + LatencyMetric.TEST_TIMEOUT) {
      delete this._tests[id]
    }
  }
}

/**
 * Returns the score for a given metric value
 * #score
 * @param {Array} value
 * @returns {Number}
 */
LatencyMetric.score = function (value) {
  return (LatencyMetric.TEST_TIMEOUT - value[0]) / LatencyMetric.TEST_TIMEOUT
}

module.exports = LatencyMetric
