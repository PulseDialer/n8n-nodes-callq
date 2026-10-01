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

export interface ContactProblem {
	problem: string;
}

export function isContactProblem(
	value: ContactCall | ContactProblem | string | Record<string, unknown>,
): value is ContactProblem {
	return typeof value === 'object' && value !== null && 'problem' in value && !('method' in value);
}

function text(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function writableBody(fields: ContactFields): Record<string, unknown> | ContactProblem {
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
			return { problem: 'Custom fields must be a JSON object' };
		}
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return { problem: 'Custom fields must be a JSON object' };
		}
		body.field_data = parsed;
	}
	return body;
}

function idempotency(fields: ContactFields): Record<string, string> | undefined {
	const key = text(fields.idempotencyKey);
	return key ? { 'Idempotency-Key': key } : undefined;
}

export function buildContactCall(operation: ContactOperation, fields: ContactFields): ContactCall | ContactProblem {
	switch (operation) {
		case 'create':
			return withBody('POST', '/contacts', fields, true);
		case 'upsert':
			return withBody('POST', '/contacts/upsert', fields, true);
		case 'get':
			return withId('GET', fields, (id) => `/contacts/${id}`);
		case 'update':
			return withBody('PATCH', '', fields, false, (id) => `/contacts/${id}`);
		case 'delete':
			return withId('DELETE', fields, (id) => `/contacts/${id}`);
		case 'getScore':
			return withId('GET', fields, (id) => `/contacts/${id}/score`);
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
			return { problem: `Unknown contact operation: ${String(neverOp)}` };
		}
	}
}

function withBody(
	method: 'POST' | 'PATCH',
	path: string,
	fields: ContactFields,
	sendKey: boolean,
	pathFor?: (id: string) => string,
): ContactCall | ContactProblem {
	const id = pathFor ? requiredId(fields) : undefined;
	if (id && isContactProblem(id)) return id;
	const body = writableBody(fields);
	if (isContactProblem(body)) return body;
	return {
		method,
		path: id ? pathFor!(id) : path,
		body,
		headers: sendKey ? idempotency(fields) : undefined,
	};
}

function withId(
	method: 'GET' | 'DELETE',
	fields: ContactFields,
	pathFor: (id: string) => string,
): ContactCall | ContactProblem {
	const id = requiredId(fields);
	if (isContactProblem(id)) return id;
	return { method, path: pathFor(id) };
}

function requiredId(fields: ContactFields): string | ContactProblem {
	const id = text(fields.contactId);
	if (!id) return { problem: 'Contact ID is required' };
	return encodeURIComponent(id);
}
