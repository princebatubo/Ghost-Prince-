// @ts-ignore
const {VersionMismatchError} = require('@tryghost/errors');
// @ts-ignore
const debug = require('@tryghost/debug')('dodo');
const Dodo = require('dodopayments'); // Hypothetical Dodo SDK

const EXPECTED_API_EFFICIENCY = 0.95;
const isTesting = process.env.NODE_ENV?.includes('testing');
const TEST_MODE_RATE_LIMIT = isTesting ? 10000 : 25;
const LIVE_MODE_RATE_LIMIT = isTesting ? 10000 : 100;

module.exports = class DodoAPI {
    /**
     * DodoAPI
     * @param {object} deps
     */
    constructor(deps) {
        this._dodo = null;
        this._configured = false;
        this.labs = deps.labs;
    }

    get configured() {
        return this._configured;
    }

    get testEnv() {
        return this._config.testEnv;
    }

    get mode() {
        return this._testMode ? 'test' : 'live';
    }

    /**
     * Configure the Dodo API
     * @param {object} config
     */
    configure(config) {
        if (!config) {
            this._dodo = null;
            this._configured = false;
            return;
        }

        const LeakyBucket = require('leaky-bucket');
        this._dodo = new Dodo.Client(config.secretKey);  // Hypothetical Dodo SDK init
        this._config = config;
        this._testMode = config.secretKey?.startsWith('test_');

        this._rateLimitBucket = new LeakyBucket(
            EXPECTED_API_EFFICIENCY * (this._testMode ? TEST_MODE_RATE_LIMIT : LIVE_MODE_RATE_LIMIT),
            1
        );

        this._configured = true;
    }

    /**
     * Example: Create a payment (Dodo version)
     */
    async createPayment(options) {
        await this._rateLimitBucket.throttle();
        const payment = await this._dodo.payments.create(options);
        return payment;
    }

    /**
     * Example: Get customer
     */
    async getCustomer(customerId) {
        await this._rateLimitBucket.throttle();
        return await this._dodo.customers.get(customerId);
    }

    /**
     * Example: Webhook parsing
     */
    parseWebhook(body, signature, secret) {
        try {
            const verified = this._dodo.webhooks.verify(body, signature, secret);
            if (!verified) throw new VersionMismatchError({message: 'Invalid webhook signature'});
            return JSON.parse(body);
        } catch (err) {
            debug(`parseWebhook -> ${err.message}`);
            throw err;
        }
    }
};
