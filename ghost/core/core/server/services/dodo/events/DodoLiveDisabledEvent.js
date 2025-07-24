/**
 * @typedef {object} DodoLiveDisabledEventData
 * @prop {string} [message] - Optional message describing why live mode was disabled
 */

/**
 * Represents a Dodo Payments "Live Mode Disabled" event.
 * 
 * This event is triggered when:
 * - A Dodo Payments account loses access to live transactions
 * - Live API keys are disabled (e.g., compliance or billing issues)
 * 
 * This class encapsulates the event payload and timestamp.
 */
module.exports = class DodoLiveDisabledEvent {
    /**
     * @param {DodoLiveDisabledEventData} data - Event payload from Dodo Payments
     * @param {Date} timestamp - Event creation timestamp
     */
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }

    /**
     * Factory method for creating a new DodoLiveDisabledEvent
     *
     * @param {DodoLiveDisabledEventData} data - Event payload from Dodo Payments
     * @param {Date} [timestamp] - Optional timestamp (defaults to current date/time)
     * @returns {DodoLiveDisabledEvent}
     */
    static create(data, timestamp) {
        return new DodoLiveDisabledEvent(data, timestamp || new Date());
    }
};
