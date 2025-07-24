# Dodo Service

This package contains code for Ghost's **Dodo Payments** integration.  
It interacts with **Dodo's API** and handles webhooks.

The main export of this package is the `DodoService` class.  
It includes a wrapper around the **Dodo Payments API** and webhook handling logic.  
It is instantiated in Ghost's `core/server/services/dodo` service.

---

## Dodo API

The `DodoAPI` class is a wrapper around the **Dodo Payments API**.  
It is used by the `DodoService` class to interact with Dodo's API.

---

## Dodo Webhooks

Ghost listens for **Dodo webhooks** to know when:  
- A customer has subscribed to a plan  
- A subscription has been cancelled or updated  
- A payment has succeeded or failed  
- A checkout session has been completed  

This integration is especially useful for **countries and regions where Stripe is not supported**.

---

### Things to keep in mind when working with Dodo webhooks:

- **Webhooks can arrive out of order.**  
  For example, `checkout.session.completed` may arrive before or after `customer.subscription.created`.

- **Webhooks can be received and processed in parallel**, so you should not rely on the order of the webhooks to determine the order of operations.

- **Operations often produce multiple events**, increasing the likelihood of race conditions.

See [Dodo’s Webhooks Guide](https://docs.dodo-payments.com/webhooks) for more information.

---

## Webhook Manager

This class is responsible for registering the webhook endpoints with **Dodo**, so Dodo knows where to send the webhooks.

---

## Webhook Controller

This class is responsible for handling the webhook events.  
It accepts the webhook event payload and delegates it to the appropriate handler based on the event type.

---

## Events

The Webhook Controller listens for the following events:

- `customer.subscription.deleted`
- `customer.subscription.updated`
- `customer.subscription.created`
- `invoice.payment_succeeded`
- `checkout.session.completed`

---

## Dodo Flows

### Checkout Session Flow: New Subscription

```mermaid
sequenceDiagram
    actor Member as Member
    participant Portal
    participant Ghost
    participant Dodo

    Member->>Portal: Signs up for a paid plan
    Portal->>Ghost: Create checkout session
    Ghost->>Dodo: Create checkout session
    Dodo-->>Ghost: Return session ID
    Ghost-->>Portal: Return session ID
    Portal->>Dodo: Redirect to checkout page
    Note over Portal: Member enters payment details in Dodo's secure portal
    Dodo-->>Portal: Redirect to success URL
    
    par Webhook Events
        Dodo->>Ghost: customer.subscription.created
        Ghost->>Ghost: Upsert member and subscription
        Dodo->>Ghost: checkout.session.completed
        Ghost->>Ghost: Upsert member and subscription
        Dodo->>Ghost: customer.subscription.updated
        Ghost->>Ghost: Upsert member and subscription
        Dodo->>Ghost: invoice.payment_succeeded
        Ghost->>Ghost: Record payment
    end
