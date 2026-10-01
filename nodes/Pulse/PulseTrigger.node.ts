import {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { verifyPulseSignature } from './verifySignature';

// Pulse emits lead.* . The labels say Contact because that is the word the
// product uses for the same record. Do not rename the values.
const EVENTS = [
	{ name: 'Contact Created', value: 'lead.created' },
	{ name: 'Contact Updated', value: 'lead.updated' },
	{ name: 'Contact Status Changed', value: 'lead.status_changed' },
	{ name: 'Contact Deleted', value: 'lead.deleted' },
	{ name: 'Contact Restored', value: 'lead.restored' },
];

export class PulseTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pulse Trigger',
		name: 'pulseTrigger',
		icon: 'file:pulse.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts when Pulse sends a contact webhook',
		defaults: { name: 'Pulse Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'pulseApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'pulse',
			},
		],
		properties: [
			{
				displayName: 'Pulse cannot register this URL for you. Copy the production URL below into Admin → Platform → Webhooks, choose the same events, and paste the whsec_ secret into the credential. A test ping (webhook.test) is acknowledged and does not start the workflow.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: EVENTS,
				default: ['lead.created'],
				required: true,
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const credentials = await this.getCredentials('pulseApi');
		const secret = String(credentials.webhookSecret ?? '');
		const req = this.getRequestObject() as { rawBody?: unknown };
		const rawBody = rawBodyText(req.rawBody);
		if (rawBody === undefined) {
			return reject.call(this, 401, 'raw_body_unavailable');
		}
		const header = firstHeader(this.getHeaderData(), 'x-pulse-signature');
		const verdict = verifyPulseSignature(rawBody, header, secret);
		if (!verdict.ok) return reject.call(this, 401, verdict.reason);

		const body = this.getBodyData() as IDataObject;
		const event = firstHeader(this.getHeaderData(), 'x-pulse-event') || String(body.event ?? '');
		if (event === 'webhook.test') {
			return { webhookResponse: { ok: true, ignored: 'webhook.test' } };
		}
		const selected = this.getNodeParameter('events') as string[];
		if (!selected.includes(event)) {
			return { webhookResponse: { ok: true, ignored: event } };
		}
		return {
			webhookResponse: { ok: true },
			workflowData: [this.helpers.returnJsonArray([body])],
		};
	}
}

function reject(this: IWebhookFunctions, code: number, reason: string): IWebhookResponseData {
	this.getResponseObject().status(code).json({ error: reason });
	return { noWebhookResponse: true };
}

function rawBodyText(raw: unknown): string | undefined {
	if (typeof raw === 'string') return raw;
	if (Buffer.isBuffer(raw)) return raw.toString('utf8');
	return undefined;
}

function firstHeader(headers: IDataObject, name: string): string | undefined {
	const value = headers[name];
	if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
	return typeof value === 'string' ? value : undefined;
}
