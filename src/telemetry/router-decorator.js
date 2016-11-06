/**
 * @module kad-telemetry/router-decorator
 */

'use strict'

var inherits = require('util').inherits
var each = require('async-each')

/**
 * Returns a decorated router that wraps node selection
 * @constructor
 * @param {kad.Router} Router
 */
function RouterDecorator (Router) {

  function TelemetryRouter (options) {
    if (!(this instanceof TelemetryRouter)) {
      return new TelemetryRouter(options)
    }

    Router.call(this, options)
  }

  inherits(TelemetryRouter, Router)

  /**
   * Wraps getNearestContacts with telemetry
   * #getNearestContacts
   * @returns {Array} shortlist
   */
  TelemetryRouter.prototype.getNearestContacts = function (key, limit, id, cb) {
    var self = this
    var callback = function (err, shortlist) {
      if (!err) {
        self._log.debug('sorting shortlist based on telemetry score')
        var profiles = {}
        each(shortlist, function (contact, iteratorCallback) {
          var profileCallback = function (err, profile) {
            profiles[contact.nodeID] = profile
            iteratorCallback(err)
          }
          self._rpc.telemetry.getProfile(contact, profileCallback)
        }, function (err) {
          if (err) {
            cb(null, shortlist)
          } else {
            shortlist.sort(self._compare.bind(self, profiles))
            cb(null, shortlist)
          }
        })
      } else {
        cb(err, null)
      }
    }
    Router.prototype.getNearestContacts.call(this, key, limit, id, callback)
  }

  /**
   * Uses the transport telemetry to compare two nodes
   * #_compare
   * @param {kad.Contact} contactA
   * @param {kad.Contact} contactB
   * @returns {Number}
   */
  TelemetryRouter.prototype._compare = function (profiles, cA, cB) {
    var profileA = profiles[cA.nodeID]
    var profileB = profiles[cB.nodeID]
    var scoresA = {}
    var scoresB = {}

    this._rpc._telopts.metrics.forEach(function (Metric) {
      var m = new Metric()
      scoresA[m.key] = Metric.score(m.getMetric(profileA))
      scoresB[m.key] = Metric.score(m.getMetric(profileB))
    })

    var resultA = TelemetryRouter.getSuccessProbability(scoresA)
    var resultB = TelemetryRouter.getSuccessProbability(scoresB)

    this._log.debug(
      'success probability is %d% vs %d%',
      (resultA * 100).toFixed(3),
      (resultB * 100).toFixed(3)
    )

    // results are close to each other, break tie with throughput score
    if (Math.abs(resultB - resultA) <= 0.005) {
      this._log.debug(
        'score difference is within threshold, selecting based on throughput'
      )
      return scoresB.throughput - scoresA.throughput
    }

    return resultB - resultA
  }

  /**
   * Uses a profile scorecard to calculate the probability of success
   * #getSuccessProbability
   * @param {Object} score
   * @returns {Number}
   */
  TelemetryRouter.getSuccessProbability = function (score) {
    return (score.reliability + score.availability + score.latency) / 3
  }

  return TelemetryRouter
}

module.exports = RouterDecorator
