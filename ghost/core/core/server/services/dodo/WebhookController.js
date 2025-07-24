const logging = require('@tryghost/logging');

module.exports = class WebhookController {
    /**
     * @param {object} deps
     * @param {import('./WebhookManager')} deps.webhookManager
     * @param {import('./services/webhook/CheckoutSessionEventService')} deps.checkoutSessionEventService
     * @param {import('./services/webhook/SubscriptionEventService')} deps.subscriptionEventService
     * @param {import('./services/webhook/InvoiceEventService')} deps.invoiceEventService
     */
    constructor(deps) {
        /** @private */
        this.webhookManager = deps.webhookManager;
        /** @private */
        this.checkoutSessionEventService = deps.checkoutSessionEventService;
        /** @private */
        this.subscriptionEventService = deps.subscriptionEventService;
        /** @private */
        this.invoiceEventService = deps.invoiceEventService;

        /**
         * Map of event type to handler
         * @private
         * @type {Record<string, Function>}
         */
        this.handlers = {
            'customer.subscription.deleted': this.subscriptionEvent,
            'customer.subscription.updated': this.subscriptionEvent,
            'customer.subscription.created': this.subscriptionEvent,
            'invoice.payment_succeeded': this.invoiceEvent,
            'checkout.session.completed': this.checkoutSessionEvent
        };
    }

    /**
     * Handles a Dodo webhook event.
     * - Verifies and parses the webhook event
     * - Delegates the event to the appropriate handler
     * - Returns HTTP response back to Dodo confirming processing
     * 
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     * @returns {Promise<void>}
     */
    async handle(req, res) {
        // Validate required body and signature
        if (!req.body || !req.headers['dodo-signature']) {
            res.writeHead(400);
            return res.end();
        }

        let event;
        try {
            event = this.webhookManager.parseWebhook(req.body, req.headers['dodo-signature']);
        } catch (err) {
            logging.error('Invalid Dodo webhook signature', err);
            res.writeHead(401);
            return res.end();
        }

        logging.info(`Handling Dodo webhook ${event.type}`);

        try {
            await this.handleEvent(event);
            res.writeHead(200);
            res.end();
        } catch (err) {
            logging.error(`Error handling Dodo webhook ${event.type}`, err);
            res.writeHead(err.statusCode || 500);
            res.end();
        }
    }

    /**
     * Accepts a webhook's event payload and delegates it to the appropriate handler
     * based on the event type
     * 
     * @private
     * @param {any} event
     * @returns {Promise<void>}
     */
    async handleEvent(event) {
        if (!this.handlers[event.type]) {
            logging.warn(`Unhandled Dodo webhook event: ${event.type}`);
            return;
        }

        await this.handlers[event.type].call(this, event.data.object);
    }

    /**
     * Delegates any `customer.subscription.*` events to the `subscriptionEventService`
     * 
     * @private
     * @param {object} subscription
     * @returns {Promise<void>}
     */
    async subscriptionEvent(subscription) {
        await this.subscriptionEventService.handleSubscriptionEvent(subscription);
    }

    /**
     * Delegates any `invoice.*` events to the `invoiceEventService`
     * 
     * @private
     * @param {object} invoice
     * @returns {Promise<void>}
     */
    async invoiceEvent(invoice) {
        await this.invoiceEventService.handleInvoiceEvent(invoice);
    }

    /**
     * Delegates any `checkout.session.*` events to the `checkoutSessionEventService`
     * 
     * @private
     * @param {object} session
     * @returns {Promise<void>}
     */
    async checkoutSessionEvent(session) {
        await this.checkoutSessionEventService.handleEvent(session);
    }
};
