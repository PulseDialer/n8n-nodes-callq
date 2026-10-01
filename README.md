# Pulse n8n node

n8n community node for [Pulse](https://github.com/PulseDialer/Pulse) contacts. Pulse is also called CallQ. Version 0.1 talks to the public API that is live today: contact actions, and a trigger for the `lead.*` webhooks Pulse already sends.

Calendar bookings and email send exist in Pulse behind flags that are off. They are not in this node. Webhook event names stay `lead.*`. A `contact.*` name is not emitted.

This package is not published to npm yet. Install it from this repository until it is.

## What you need in Pulse

1. Sign in to the CRM.
2. Admin → Platform → API Keys → Create. Check `read:leads` and `write:leads`. Copy the `plk_` key. It is shown once.
3. For the trigger only: Admin → Platform → Webhooks → Create. Paste the production URL from the Pulse Trigger node, and select the same events. Copy the `whsec_` secret. It is shown once.

The API key cannot create that webhook subscription. Pulse only allows it from the admin screen, so the trigger receives deliveries and checks the signature. It does not register itself.

## Install into n8n

```bash
npm install
npm run build
mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm install /absolute/path/to/n8n-nodes-pulse
```

Restart n8n. Add the **Pulse API** credential: base URL `https://dialer.timesharehelpcenter.com` unless the CRM is on another host, the `plk_` key, and the `whsec_` secret if you use the trigger.

The credential test calls `GET /api/v1/public/me`.

## Nodes

**Pulse** operations: Create or Update (match on phone or email), Create, Update, Get, Get Many, Delete, Get Score, List Fields. Create and Create or Update take an optional idempotency key. The same key on the same route returns the first response for 24 hours.

**Pulse Trigger** events: Contact Created (`lead.created`), Contact Updated (`lead.updated`), Contact Status Changed (`lead.status_changed`), Contact Deleted (`lead.deleted`), Contact Restored (`lead.restored`). A delivery with a bad or missing signature is rejected with HTTP 401, so Pulse records the failure instead of starting the workflow. A `webhook.test` ping is acknowledged and does not start the workflow. An event you did not select is acknowledged and does not start the workflow.

## Develop

```bash
npm test
npm run build
```

`npm test` covers the signature check and the request each operation builds. It does not call Pulse.
