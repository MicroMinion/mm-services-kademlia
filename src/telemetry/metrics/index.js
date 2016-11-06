/**
 * @module kad-telemetry/metrics
 */

'use strict'

module.exports = {
  Availability: require('./availability'),
  Latency: require('./latency'),
  Reliability: require('./reliability'),
  Throughput: require('./throughput')
}
