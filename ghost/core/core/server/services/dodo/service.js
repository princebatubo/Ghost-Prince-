const _ = require('lodash');
const DodoService = require('./DodoService');
const logging = require('@tryghost/logging');
const membersService = require('../members');
const config = require('../../../shared/config');
const settings = require('../../../shared/settings-cache');
const urlUtils = require('../../../shared/url-utils');
const events = require('../../lib/common/events');
const models = require('../../models');
const {getConfig} = require('./config');
const settingsHelpers = require('../settings-helpers');
const donationService = require('../donations');
const staffService = require('../staff');
const labs = require('../../../shared/labs');

/**
 * Configures and initializes the Dodo API.
 * - Retrieves active Dodo keys from settings
 * - Configures webhook URLs and event handling
 * - Ensures that test environments are handled correctly
 */
async function configureApi() {
    const cfg = getConfig({settingsHelpers, config, urlUtils});
    if (cfg) {
        // @NOTE: Avoid starting live mode in automated test environments
        cfg.testEnv = process.env.NODE_ENV.startsWith('test') && process.env.NODE_ENV !== 'testing-browser';
        await module.exports.configure(cfg);
        return true;
    }
    return false;
}

/**
 * Debounced configuration to avoid multiple rapid API re-initializations
 */
const debouncedConfigureApi = _.debounce(() => {
    configureApi().catch((err) => {
        logging.error(err);
    });
}, 600);

/**
 * Exported singleton instance of the Dodo Payments service
 * Includes:
 * - Core Dodo API connection
 * - Webhook manager persistence
 * - Models required for subscription and payment management
 */
module.exports = new DodoService({
    labs,
    membersService,
    models: _.pick(models, [
        'Product',
        'DodoPrice',
        'DodoCustomerSubscription',
        'DodoProduct',
        'MemberDodoCustomer',
        'Offer',
        'Settings'
    ]),
    DodoWebhook: {
        async get() {
            return {
                webhook_id: settings.get('members_dodo_webhook_id'),
                secret: settings.get('members_dodo_webhook_secret')
            };
        },
        async save(data) {
            await models.Settings.edit([{
                key: 'members_dodo_webhook_id',
                value: data.webhook_id
            }, {
                key: 'members_dodo_webhook_secret',
                value: data.secret
            }]);
        }
    },
    donationService,
    staffService
});

/**
 * Handles changes in Dodo-related settings and triggers reconfiguration
 * @param {object} model - The updated settings model
 */
function dodoSettingsChanged(model) {
    if ([
        'dodo_publishable_key',
        'dodo_secret_key',
        'dodo_connect_publishable_key',
        'dodo_connect_secret_key'
    ].includes(model.get('key'))) {
        debouncedConfigureApi();
    }
}

/**
 * Initializes the Dodo Payments service and sets up event listeners
 */
module.exports.init = async function init() {
    try {
        await configureApi();
    } catch (err) {
        logging.error(err);
    }

    events
        .removeListener('settings.edited', dodoSettingsChanged)
        .on('settings.edited', dodoSettingsChanged);
};
