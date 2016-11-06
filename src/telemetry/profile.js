/**
 * @class kad-telemetry/profile
 */

'use strict'

/**
 * Represents a "profile" for a node containing metrics
 * @constructor
 * @param {Object} spec
 */
function Profile (spec) {
  if (!(this instanceof Profile)) {
    return new Profile(spec)
  }

  this.metrics = spec ? spec.metrics : {}
}

module.exports = Profile
