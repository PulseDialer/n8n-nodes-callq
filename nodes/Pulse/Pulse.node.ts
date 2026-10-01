import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { buildContactCall, ContactFields, ContactOperation, isContactProblem } from './contactRequest';

const FIELD_PROPERTIES = [
	{ displayName: 'First Name', name: 'firstName', type: 'string' as const, default: '' },
	{ displayName: 'Last Name', name: 'lastName', type: 'string' as const, default: '' },
	{ displayName: 'Email', name: 'email', type: 'string' as const, default: '', placeholder: 'name@example.com' },
	{ displayName: 'Phone', name: 'phone', type: 'string' as const, default: '' },
	{ displayName: 'Status', name: 'leadStatus', type: 'string' as const, default: '', description: 'A stage name from the contacts pipeline. The stage ID is the name.' },
	{ displayName: 'Source', name: 'leadSource', type: 'string' as const, default: '' },
	{
		displayName: 'Custom Fields',
		name: 'fieldData',
		type: 'json' as const,
		default: '',
		description: 'JSON object written to field_data. System fields such as email stay in the boxes above, not in here.',
	},
];

export class Pulse implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pulse',
		name: 'pulse',
		icon: { light: 'file:pulse.svg', dark: 'file:pulse.dark.svg' },
		group: ['transform'],
		version: 1,
		usableAsTool: true,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Look up, create, and update Pulse contacts',
		defaults: { name: 'Pulse' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'pulseApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Contact', value: 'contact' }],
				default: 'contact',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Create', value: 'create', action: 'Create a contact' },
					{ name: 'Create or Update', value: 'upsert', action: 'Create or update a contact', description: 'Create a new record, or update the current one if it already exists (upsert)' },
					{ name: 'Delete', value: 'delete', action: 'Delete a contact' },
					{ name: 'Get', value: 'get', action: 'Get a contact' },
					{ name: 'Get Many', value: 'getAll', action: 'List contacts' },
					{ name: 'Get Score', value: 'getScore', action: 'Get a contact score' },
					{ name: 'List Fields', value: 'getFields', action: 'List contact fields' },
					{ name: 'Update', value: 'update', action: 'Update a contact' },
				],
				default: 'upsert',
			},
			{
				displayName: 'Contact ID',
				name: 'contactId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['get', 'update', 'delete', 'getScore'] } },
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['create', 'upsert'] } },
				description: 'Optional. The same key on the same route returns the first response for 24 hours instead of writing again.',
			},
			...FIELD_PROPERTIES.map((field) => ({
				...field,
				displayOptions: { show: { operation: ['create', 'upsert', 'update'] } },
			})),
			{
				displayName: 'Search',
				name: 'query',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['getAll'] } },
				description: 'Matches name, email, or phone',
			},
			{
				displayName: 'Phone',
				name: 'filterPhone',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['getAll'] } },
				description: 'Exact phone match, compared as digits',
			},
			{
				displayName: 'Email',
				name: 'filterEmail',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['getAll'] } },
				description: 'Exact email match, ignoring case',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				description: 'Max number of results to return',
				typeOptions: { minValue: 1, maxValue: 200 },
				default: 50,
				displayOptions: { show: { operation: ['getAll'] } },
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				displayOptions: { show: { operation: ['getAll'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('pulseApi');
		const baseUrl = String(credentials.baseUrl ?? '').replace(/\/$/, '');
		if (!baseUrl) throw new NodeOperationError(this.getNode(), 'Base URL is empty');

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as ContactOperation;
				const fields = readFields(this, operation, i);
				const built = buildContactCall(operation, fields);
				if (isContactProblem(built)) throw new NodeOperationError(this.getNode(), built.problem);
				const call = built;
				const response: unknown = await this.helpers.httpRequestWithAuthentication.call(this, 'pulseApi', {
					method: call.method,
					url: `${baseUrl}/api/v1/public${call.path}`,
					body: call.body,
					qs: call.qs,
					headers: call.headers,
					json: true,
				});
				const json = (response ?? {}) as IDataObject;
				returnData.push({ json, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [returnData];
	}
}

function readFields(ctx: IExecuteFunctions, operation: ContactOperation, i: number): ContactFields {
	const needsId = operation === 'get' || operation === 'update' || operation === 'delete' || operation === 'getScore';
	const writes = operation === 'create' || operation === 'upsert' || operation === 'update';
	const fields: ContactFields = {};
	if (needsId) fields.contactId = ctx.getNodeParameter('contactId', i) as string;
	if (operation === 'create' || operation === 'upsert') {
		fields.idempotencyKey = ctx.getNodeParameter('idempotencyKey', i) as string;
	}
	if (writes) {
		fields.firstName = ctx.getNodeParameter('firstName', i) as string;
		fields.lastName = ctx.getNodeParameter('lastName', i) as string;
		fields.email = ctx.getNodeParameter('email', i) as string;
		fields.phone = ctx.getNodeParameter('phone', i) as string;
		fields.leadStatus = ctx.getNodeParameter('leadStatus', i) as string;
		fields.leadSource = ctx.getNodeParameter('leadSource', i) as string;
		const custom = ctx.getNodeParameter('fieldData', i);
		fields.fieldData = typeof custom === 'string' ? custom : JSON.stringify(custom ?? '');
	}
	if (operation === 'getAll') {
		fields.query = ctx.getNodeParameter('query', i) as string;
		fields.filterPhone = ctx.getNodeParameter('filterPhone', i) as string;
		fields.filterEmail = ctx.getNodeParameter('filterEmail', i) as string;
		fields.limit = ctx.getNodeParameter('limit', i) as number;
		fields.offset = ctx.getNodeParameter('offset', i) as number;
	}
	return fields;
}
