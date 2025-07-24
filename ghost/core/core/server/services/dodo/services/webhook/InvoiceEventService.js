const errors = require('@tryghost/errors');

/**
 * Handles `invoice.payment_succeeded` webhook events for Dodo Payments
 * 
 * The `invoice.payment_succeeded` event is triggered when a customer's payment succeeds.
 *
 * It primarily occurs when:
 * - A subscription renewal payment succeeds
 * - A payment for a usage-based or recurring invoice succeeds
 *
 * This service is focused on linking payment events to the appropriate member and product
 * in the Ghost system.
 *
 * The Dodo invoice payload format can be found here: 
 * https://dodopayments.com/docs/api/invoices
 */
module.exports = class DodoInvoiceEventService {
    /**
     * @param {object} deps
     * @param {import('../../DodoAPI')} deps.api - Dodo API wrapper
     * @param {object} deps.memberRepository - Repository for Ghost members
     * @param {object} deps.eventRepository - Repository for recording events
     * @param {object} deps.productRepository - Repository for Ghost products
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * Handles an `invoice.payment_succeeded` event
     * 
     * Inserts a payment event into the database when linked to an active subscription.
     * 
     * @param {import('dodo').Invoice} invoice - Dodo invoice payload
     */
    async handleInvoiceEvent(invoice) {
        const {api, memberRepository, eventRepository, productRepository} = this.deps;

        if (!invoice.subscription) {
            // One-time payments (like donations) are handled in checkoutSessionEvent
            // because custom donation messages are not available in the invoice object.
            return;
        }

        const subscription = await api.getSubscription(invoice.subscription, {
            expand: ['default_payment_method']
        });

        const member = await memberRepository.get({
            customer_id: subscription.customer
        });

        if (member) {
            // Payment succeeded and amount is non-zero
            if (invoice.paid && invoice.amount_paid !== 0) {
                await eventRepository.registerPayment({
                    member_id: member.id,
                    currency: invoice.currency,
                    amount: invoice.amount_paid
                });
            }
        } else {
            // Ignore subscriptions that have multiple plans not managed by our system
            if (!subscription.plan) {
                return;
            }
            // Ensure this subscription is for one of our configured products
            const product = await productRepository.get({
                dodo_product_id: subscription.plan.product
            });
            if (!product) {
                return;
            }
            // No member found linked to this subscription; throw an error
            throw new errors.NotFoundError({
                message: `No member found for customer ${subscription.customer}`
            });
        }
    }
};
