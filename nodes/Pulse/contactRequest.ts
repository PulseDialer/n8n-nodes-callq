// Turns node parameters into one public-API call. Contacts are leads: the
// paths are /contacts, the event names elsewhere stay lead.*.

export type ContactOperation =
	| 'create'
	| 'upsert'
	| 'get'
	| 'getAll'
	| 'update'
	| 'delete'
	| 'getFields'
	| 'getScore';

export interface ContactFields {
	firstName?: string;
	lastName?: string;
	email?: string;
	phone?: string;
	leadStatus?: string;
	leadSource?: string;
	fieldData?: string;
	idempotencyKey?: string;
	contactId?: string;
	query?: string;
	filterPhone?: string;
	filterEmail?: string;
	limit?: number;
	offset?: number;
}

export interface ContactCall {
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	path: string;
	body?: Record<string, unknown>;
	qs?: Record<string, string | number>;
	headers?: Record<string, string>;
}

function text(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function writableBody(fields: ContactFields): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	const first = text(fields.firstName);
	const last = text(fields.lastName);
	const email = text(fields.email);
	const phone = text(fields.phone);
	const status = text(fields.leadStatus);
	const source = text(fields.leadSource);
	if (first) body.first_name = first;
	if (last) body.last_name = last;
	if (email) body.primary_email = email;
	if (phone) body.primary_phone = phone;
	if (status) body.lead_status = status;
	if (source) body.lead_source = source;
	const raw = text(fields.fieldData);
	if (raw) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			throw new Error('Custom fields must be a JSON object');
		}
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error('Custom fields must be a JSON object');
		}
		body.field_data = parsed;
	}
	return body;
}

function idempotency(fields: ContactFields): Record<string, string> | undefined {
	const key = text(fields.idempotencyKey);
	return key ? { 'Idempotency-Key': key } : undefined;
}

export function buildContactCall(operation: ContactOperation, fields: ContactFields): ContactCall {
	switch (operation) {
		case 'create':
			return { method: 'POST', path: '/contacts', body: writableBody(fields), headers: idempotency(fields) };
		case 'upsert':
			return { method: 'POST', path: '/contacts/upsert', body: writableBody(fields), headers: idempotency(fields) };
		case 'get':
			return { method: 'GET', path: `/contacts/${requiredId(fields)}` };
		case 'update':
			return { method: 'PATCH', path: `/contacts/${requiredId(fields)}`, body: writableBody(fields) };
		case 'delete':
			return { method: 'DELETE', path: `/contacts/${requiredId(fields)}` };
		case 'getScore':
			return { method: 'GET', path: `/contacts/${requiredId(fields)}/score` };
		case 'getFields':
			return { method: 'GET', path: '/contacts/fields' };
		case 'getAll': {
			const qs: Record<string, string | number> = {};
			const query = text(fields.query);
			const phone = text(fields.filterPhone);
			const email = text(fields.filterEmail);
			if (query) qs.q = query;
			if (phone) qs.phone = phone;
			if (email) qs.email = email;
			if (fields.limit !== undefined && fields.limit !== null) qs.limit = fields.limit;
			if (fields.offset !== undefined && fields.offset !== null && fields.offset !== 0) qs.offset = fields.offset;
			return { method: 'GET', path: '/contacts', qs };
		}
		default: {
			const neverOp: never = operation;
			throw new Error(`Unknown contact operation: ${String(neverOp)}`);
		}
	}
}

function requiredId(fields: ContactFields): string {
	const id = text(fields.contactId);
	if (!id) throw new Error('Contact ID is required');
	return encodeURIComponent(id);
}
