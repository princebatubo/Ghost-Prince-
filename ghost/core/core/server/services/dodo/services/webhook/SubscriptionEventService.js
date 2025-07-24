const errors = require('@tryghost/errors');
const _ = require('lodash');

/**
 * Handles `customer.subscription.*` webhook events for Dodo Payments
 * 
 * The `customer.subscription.*` events are triggered when a customer's subscription status changes.
 * 
 * Typical scenarios include:
 * - Subscription created
 * - Subscription updated (e.g., upgrade/downgrade)
 * - Subscription cancelled or expired
 *
 * This service is responsible for handling these events and updating the subscription status in Ghost,
 * delegating persistence to the `MemberRepository`.
 *
 * Dodo subscription event reference:
 * https://dodopayments.com/docs/api/webhooks#customer-subscription
 */
module.exports = class DodoSubscriptionEventService {
    /**
     * @param {object} deps
     * @param {import('../../repositories/MemberRepository')} deps.memberRepository - Repository for Ghost members
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * Handles a `customer.subscription.*` event
     * 
     * Looks up the member by the Dodo customer ID and links the subscription to the member.
     * 
     * @param {import('dodo').Subscription} subscription - Dodo subscription payload
     */
    async handleSubscriptionEvent(subscription) {
        const subscriptionPriceData = _.get(subscription, 'items.data');
        if (!subscriptionPriceData || subscriptionPriceData.length !== 1) {
            throw new errors.BadRequestError({
                message: 'Subscription should have exactly 1 price item'
            });
        }

        const memberRepository = this.deps.memberRepository;
        const member = await memberRepository.get({
            customer_id: subscription.customer
        });

        if (member) {
            try {
                await memberRepository.linkSubscription({
                    id: member.id,
                    subscription
                });
            } catch (err) {
                // Ignore duplicate key errors (caused by re-linking same subscription)
                if (err.code !== 'ER_DUP_ENTRY' && err.code !== 'SQLITE_CONSTRAINT') {
                    throw err;
                }
                throw new errors.ConflictError({err});
            }
        }
    }
};
