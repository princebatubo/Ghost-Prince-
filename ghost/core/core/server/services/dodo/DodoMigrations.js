const _ = require('lodash');
const logging = require('@tryghost/logging');

module.exports = class DodoMigrations {
    /**
     * DodoMigrations
     *
     * @param {object} params
     * @param {any} params.models
     * @param {import('./DodoAPI')} params.api
     */
    constructor({models, api}) {
        this.models = models;
        this.api = api;
    }

    async execute() {
        if (!this.api._configured) {
            logging.info('Dodo not configured - skipping migrations');
            return;
        } else if (this.api.testEnv) {
            logging.info('Dodo is in test mode - skipping migrations');
            return;
        }

        try {
            await this.populateProductsAndPrices();
            await this.populateDodoPricesFromPlansSetting();
            await this.populateMembersMonthlyPriceIdSettings();
            await this.populateMembersYearlyPriceIdSettings();
            await this.populateDefaultProductMonthlyPriceId();
            await this.populateDefaultProductYearlyPriceId();
            await this.revertPortalPlansSetting();
            await this.removeInvalidSubscriptions();
            await this.setDefaultProductName();
            await this.updateDodoProductNamesFromDefaultProduct();
        } catch (err) {
            logging.error(err);
        }
    }

    async populateProductsAndPrices(options) {
        if (!options) {
            return this.models.Product.transaction((transacting) =>
                this.populateProductsAndPrices({transacting})
            );
        }
        const subscriptionModels = await this.models.DodoCustomerSubscription.findAll(options);
        const priceModels = await this.models.DodoPrice.findAll(options);
        const productModels = await this.models.DodoProduct.findAll(options);
        const subscriptions = subscriptionModels.toJSON();
        const prices = priceModels.toJSON();
        const products = productModels.toJSON();
        const {data} = await this.models.Product.findPage({
            ...options,
            limit: 1,
            filter: 'type:paid'
        });
        const defaultProduct = data[0] && data[0].toJSON();

        if (subscriptions.length > 0 && products.length === 0 && prices.length === 0 && defaultProduct) {
            try {
                logging.info(`Populating products and prices for existing Dodo customers`);
                const uniquePlans = _.uniq(subscriptions.map(d => _.get(d, 'plan.id')));

                let dodoPrices = [];
                for (const plan of uniquePlans) {
                    try {
                        const dodoPrice = await this.api.getPrice(plan, {expand: ['product']});
                        dodoPrices.push(dodoPrice);
                    } catch (err) {
                        if (err && err.statusCode === 404) {
                            logging.warn(`Plan ${plan} not found on Dodo - ignoring`);
                        } else {
                            throw err;
                        }
                    }
                }
                logging.info(`Adding ${dodoPrices.length} prices from Dodo`);
                for (const dodoPrice of dodoPrices) {
                    /** @type {import('dodo-payments').Product} */
                    const dodoProduct = dodoPrice.product;

                    await this.models.DodoProduct.upsert({
                        product_id: defaultProduct.id,
                        dodo_product_id: dodoProduct.id
                    }, options);

                    await this.models.DodoPrice.add({
                        dodo_price_id: dodoPrice.id,
                        dodo_product_id: dodoProduct.id,
                        active: dodoPrice.active,
                        nickname: dodoPrice.nickname,
                        currency: dodoPrice.currency,
                        amount: dodoPrice.unit_amount,
                        type: 'recurring',
                        interval: dodoPrice.recurring.interval
                    }, options);
                }
            } catch (e) {
                logging.error(`Failed to populate products/prices from Dodo`);
                logging.error(e);
            }
        }
    }

    async findPriceByPlan(plan, options) {
        const currency = plan.currency ? plan.currency.toLowerCase() : 'usd';
        const amount = Number.isInteger(plan.amount) ? plan.amount : parseInt(plan.amount);
        const interval = plan.interval;

        return await this.models.DodoPrice.findOne({currency, amount, interval}, options);
    }

    async getPlanFromPrice(priceId, options) {
        const price = await this.models.DodoPrice.findOne({id: priceId}, options);
        if (price?.get('interval') === 'month') return 'monthly';
        if (price?.get('interval') === 'year') return 'yearly';
        return null;
    }

    async populateDodoPricesFromPlansSetting(options) {
        if (!options) {
            return this.models.Product.transaction((transacting) =>
                this.populateDodoPricesFromPlansSetting({transacting})
            );
        }
        const plansSetting = await this.models.Settings.findOne({key: 'dodo_plans'}, options);
        let plans;
        try {
            plans = JSON.parse(plansSetting.get('value'));
        } catch (err) {
            return;
        }
        let defaultDodoProduct;
        const dodoProductsPage = await this.models.DodoProduct.findPage({...options, limit: 1});
        defaultDodoProduct = dodoProductsPage.data[0];

        if (!defaultDodoProduct) {
            logging.info('Could not find Dodo Product - creating one');
            const productsPage = await this.models.Product.findPage({...options, limit: 1, filter: 'type:paid'});
            const defaultProduct = productsPage.data[0];
            const dodoProduct = await this.api.createProduct({name: defaultProduct.get('name')});
            if (!defaultProduct) {
                logging.error('Could not find Product - skipping dodo_plans -> dodo_prices migration');
                return;
            }
            defaultDodoProduct = await this.models.DodoProduct.add({
                product_id: defaultProduct.id,
                dodo_product_id: dodoProduct.id
            }, options);
        }

        for (const plan of plans) {
            const existingPrice = await this.findPriceByPlan(plan, options);
            if (!existingPrice) {
                logging.info(`Creating Dodo Price ${JSON.stringify(plan)}`);
                const price = await this.api.createPrice({
                    currency: plan.currency,
                    amount: plan.amount,
                    nickname: plan.name,
                    interval: plan.interval,
                    active: true,
                    type: 'recurring',
                    product: defaultDodoProduct.get('dodo_product_id')
                });

                await this.models.DodoPrice.add({
                    dodo_price_id: price.id,
                    dodo_product_id: defaultDodoProduct.get('dodo_product_id'),
                    active: price.active,
                    nickname: price.nickname,
                    currency: price.currency,
                    amount: price.unit_amount,
                    type: 'recurring',
                    interval: price.recurring.interval
                }, options);
            }
        }
    }

    // The rest of the functions (populateMembersMonthlyPriceIdSettings, populateMembersYearlyPriceIdSettings,
    // populateDefaultProductMonthlyPriceId, populateDefaultProductYearlyPriceId, revertPortalPlansSetting,
    // removeInvalidSubscriptions, setDefaultProductName, updateDodoProductNamesFromDefaultProduct)
    // will mirror the structure of the Stripe versions, but using Dodo models (DodoPrice, DodoProduct, DodoCustomerSubscription).
};
