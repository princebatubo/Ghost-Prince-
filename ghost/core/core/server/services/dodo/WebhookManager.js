/**
 * @typedef {import('./DodoAPI')} DodoAPI
 */

/**
 * @typedef {object} DodoWebhookModel
 * @prop {string|null} webhook_id
 * @prop {string|null} secret
 */

/**
 * @typedef {object} DodoWebhook
 * @prop {(data: DodoWebhookModel) => Promise<void>} save
 * @prop {() => Promise<DodoWebhookModel>} get
 */

module.exports = class WebhookManager {
    /**
     * @param {object} deps
     * @param {DodoWebhook} deps.DodoWebhook
     * @param {DodoAPI} deps.api
     */
    constructor({DodoWebhook, api}) {
        /** @private */
        this.DodoWebhook = DodoWebhook;
        /** @private */
        this.api = api;
        /** @private */
        this.config = null;
        /** @private */
        this.webhookSecret = null;
        /**
         * @private
         * @type {'network'|'local'}
         */
        this.mode = 'network';
    }

    /** 
     * List of webhook events handled by Ghost for Dodo 
     * @type {string[]} 
     */
    static events = [
        'checkout.session.completed',
        'customer.subscription.deleted',
        'customer.subscription.updated',
        'customer.subscription.created',
        'invoice.payment_succeeded'
    ];

    /**
     * Deletes the Dodo Webhook Endpoint and clears stored webhook data.
     * 
     * @returns {Promise<boolean>}
     */
    async stop() {
        if (this.mode !== 'network') {
            return;
        }

        try {
            const existingWebhook = await this.DodoWebhook.get();
            if (existingWebhook.webhook_id) {
                await this.api.deleteWebhookEndpoint(existingWebhook.webhook_id);
            }
            await this.DodoWebhook.save({
                webhook_id: null,
                secret: null
            });
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Starts the Dodo Webhook Endpoint and saves the webhook ID and secret.
     * 
     * @returns {Promise<void>}
     */
    async start() {
        if (this.mode !== 'network') {
            return;
        }
        const existingWebhook = await this.DodoWebhook.get();

        const webhook = await this.setupWebhook(existingWebhook.webhook_id, existingWebhook.secret);

        await this.DodoWebhook.save({
            webhook_id: webhook.id,
            secret: webhook.secret
        });

        this.webhookSecret = webhook.secret;
    }

    /**
     * Configures the Dodo Webhook Manager.
     * @param {object} config
     * @param {string} [config.webhookSecret] An optional webhook secret for use with local testing, bypassing Dodo network webhook creation
     * @param {string} config.webhookHandlerUrl The URL which the Webhook should hit
     *
     * @returns {Promise<void>}
     */
    async configure(config) {
        this.config = config;
        if (config.webhookSecret) {
            this.webhookSecret = config.webhookSecret;
            this.mode = 'local';
        }
    }

    /**
     * Setup a new Dodo Webhook Endpoint.
     * - If the webhook exists, delete it and create a new one
     * - If the webhook does not exist, create a new one
     * 
     * @param {string} [id]
     * @param {string} [secret]
     * @param {object} [opts]
     * @param {boolean} [opts.forceCreate]
     * @param {boolean} [opts.skipDelete]
     *
     * @returns {Promise<{id: string, secret: string}>}
     */
    async setupWebhook(id, secret, opts = {}) {
        if (!id || !secret || opts.forceCreate) {
            if (id && !opts.skipDelete) {
                try {
                    await this.api.deleteWebhookEndpoint(id);
                } catch (err) {
                    // ignore delete errors
                }
            }
            const webhook = await this.api.createWebhookEndpoint(
                this.config.webhookHandlerUrl,
                WebhookManager.events
            );
            return {
                id: webhook.id,
                secret: webhook.secret
            };
        } else {
            try {
                await this.api.updateWebhookEndpoint(
                    id,
                    this.config.webhookHandlerUrl,
                    WebhookManager.events
                );

                return {id, secret};
            } catch (err) {
                if (err.code === 'resource_missing') {
                    return this.setupWebhook(id, secret, {skipDelete: true, forceCreate: true});
                }
                return this.setupWebhook(id, secret, {skipDelete: false, forceCreate: true});
            }
        }
    }

    /**
     * Parse a Dodo Webhook event.
     * 
     * @param {string} body
     * @param {string} signature
     * @returns {any} Parsed event from DodoAPI
     */
    parseWebhook(body, signature) {
        return this.api.parseWebhook(body, signature, this.webhookSecret);
    }
};
