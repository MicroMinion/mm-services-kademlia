/**
 * @class kad-telemetry/metric
 */

'use strict'

var assert = require('assert')
var Profile = require('./profile')

/**
 * Base class for metric implementations
 * @constructor
 */
function Metric () {
  if (!(this instanceof Metric)) {
    return new Metric()
  }

  this.default = []
  this.key = null
  this.hooks = []
}

/**
 * Applys the provided value to the designated key on the given object
 * #setMetric
 * @param {telemetry.Profile} profile
 * @param {Mixed} metric
 */
Metric.prototype.setMetric = function (profile, metric) {
  assert(profile instanceof Profile, 'Invalid profile supplied')

  profile.metrics[this.key] = metric
}

/**
 * Returns the value of the designated key on the given object
 * #setMetric
 * @param {telemetry.Profile} profile
 */
Metric.prototype.getMetric = function (profile) {
  assert(profile instanceof Profile, 'Invalid profile supplied')
  return profile.metrics[this.key] || this.default.slice(0)
}

/**
 * Converts the value stored for a metric into a score
 * @param {Mixed} value
 */
Metric.score = function (value) {
  assert.ok(value !== undefined, 'Missing param `a`')

  return 0
}

module.exports = Metric
