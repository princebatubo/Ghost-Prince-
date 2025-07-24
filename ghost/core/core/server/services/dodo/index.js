/**
 * Dodo Payments Integration
 *
 * This module exports the core Dodo Service instance that contains:
 * - API configuration for Dodo Payments
 * - Webhook management for handling incoming payment events
 * - Subscription, invoice, and checkout session event services
 *
 * Usage:
 * ```js
 * const DodoService = require('@tryghost/dodo');
 * const dodo = new DodoService(dependencies);
 * await dodo.configure(config);
 * ```
 *
 * @module @tryghost/dodo
 */

module.exports = require('./service');
