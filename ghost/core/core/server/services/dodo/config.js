const logging = require('@tryghost/logging');
const tpl = require('@tryghost/tpl');
const labs = require('../../../shared/labs');

const messages = {
    remoteWebhooksInDevelopment: 'Cannot use remote webhooks in development. See Dodo documentation for testing webhooks locally.'
};

/**
 * @typedef {object} DodoURLConfig
 * @prop {string} checkoutSessionSuccessUrl URL to redirect after a successful checkout session
 * @prop {string} checkoutSessionCancelUrl URL to redirect if checkout is canceled
 * @prop {string} checkoutSetupSessionSuccessUrl URL to redirect after successful billing setup
 * @prop {string} checkoutSetupSessionCancelUrl URL to redirect if billing setup is canceled
 */

/**
 * Returns the complete configuration required for integrating with the Dodo Payments API.
 * - Includes keys, webhook secrets, and URL endpoints for checkout and billing setup sessions.
 *
 * @module getConfig
 */
module.exports = {
    /**
     * Builds the final configuration object for Dodo.
     *
     * @param {object} deps
     * @param {import('config')} deps.config Node config instance
     * @param {import('../../../shared/url-utils')} deps.urlUtils Utility for generating URLs
     * @param {import('../../../shared/settings-helpers')} deps.settingsHelpers Helper to retrieve active payment keys
     *
     * @returns {object|null} Complete Dodo configuration or `null` if keys are not active
     */
    getConfig({config, urlUtils, settingsHelpers}) {
        /**
         * Generates all the Dodo session URLs required for checkout and billing setup.
         *
         * @private
         * @returns {DodoURLConfig}
         */
        function getDodoUrlConfig() {
            const siteUrl = urlUtils.getSiteUrl();

            // Checkout session URLs
            const checkoutSuccessUrl = new URL(siteUrl);
            checkoutSuccessUrl.searchParams.set('dodo', 'success');

            const checkoutCancelUrl = new URL(siteUrl);
            checkoutCancelUrl.searchParams.set('dodo', 'cancel');

            // Billing setup session URLs
            const billingSuccessUrl = new URL(siteUrl);
            billingSuccessUrl.searchParams.set('dodo', 'billing-update-success');

            const billingCancelUrl = new URL(siteUrl);
            billingCancelUrl.searchParams.set('dodo', 'billing-update-cancel');

            return {
                checkoutSessionSuccessUrl: checkoutSuccessUrl.href,
                checkoutSessionCancelUrl: checkoutCancelUrl.href,
                checkoutSetupSessionSuccessUrl: billingSuccessUrl.href,
                checkoutSetupSessionCancelUrl: billingCancelUrl.href
            };
        }

        // Retrieve active Dodo keys
        const keys = settingsHelpers.getActiveDodoKeys();
        if (!keys) {
            return null;
        }

        const env = config.get('env');
        let webhookSecret = process.env.DODO_WEBHOOK_SECRET;

        // Default secret for non-production environments
        if (env !== 'production') {
            if (!webhookSecret) {
                webhookSecret = 'DEFAULT_DODO_WEBHOOK_SECRET';
                logging.warn(tpl(messages.remoteWebhooksInDevelopment));
            }
        }

        // Build the webhook handler endpoint
        const webhookHandlerUrl = new URL('members/webhooks/dodo/', urlUtils.getSiteUrl());

        // Build final config object
        const urls = getDodoUrlConfig();

        return {
            ...keys,
            ...urls,
            enablePromoCodes: config.get('enableDodoPromoCodes'),
            /**
             * Getter for enabling automatic tax collection
             */
            get enableAutomaticTax() {
                return labs.isSet('dodoAutomaticTax');
            },
            webhookSecret: webhookSecret,
            webhookHandlerUrl: webhookHandlerUrl.href
        };
    }
};
