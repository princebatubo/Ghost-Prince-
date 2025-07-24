/**
 * @typedef {object} DodoLiveEnabledEventData
 * @prop {string} message - A descriptive message indicating why live mode was enabled
 */

/**
 * Represents a Dodo Payments "Live Mode Enabled" event.
 * 
 * This event is triggered when:
 * - A Dodo Payments account is successfully verified for live transactions
 * - Live API keys are activated or re-enabled after being disabled
 * 
 * This class encapsulates the event payload and timestamp.
 */
module.exports = class DodoLiveEnabledEvent {
    /**
     * @param {DodoLiveEnabledEventData} data - Event payload from Dodo Payments
     * @param {Date} timestamp - Event creation timestamp
     */
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }

    /**
     * Factory method for creating a new DodoLiveEnabledEvent
     *
     * @param {DodoLiveEnabledEventData} data - Event payload from Dodo Payments
     * @param {Date} [timestamp] - Optional timestamp (defaults to current date/time)
     * @returns {DodoLiveEnabledEvent}
     */
    static create(data, timestamp) {
        return new DodoLiveEnabledEvent(data, timestamp || new Date());
    }
};
