/**
 * Dodo Payments Event Index
 * 
 * This index file aggregates and exports all event classes 
 * related to Dodo Payments webhook system.
 * 
 * Currently includes:
 * - DodoLiveEnabledEvent: Represents when Dodo Payments live mode is enabled
 * - DodoLiveDisabledEvent: Represents when Dodo Payments live mode is disabled
 */

module.exports = {
    DodoLiveEnabledEvent: require('./DodoLiveEnabledEvent'),
    DodoLiveDisabledEvent: require('./DodoLiveDisabledEvent')
};
