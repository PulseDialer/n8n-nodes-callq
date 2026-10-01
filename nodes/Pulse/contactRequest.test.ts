import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildContactCall, isContactProblem } from './contactRequest.ts';

function callOf(operation: Parameters<typeof buildContactCall>[0], fields: Parameters<typeof buildContactCall>[1]) {
	const built = buildContactCall(operation, fields);
	if (isContactProblem(built)) throw new Error(built.problem);
	return built;
}

describe('buildContactCall', () => {
	it('upserts with only the fields that were filled in, and sends the idempotency key', () => {
		const call = callOf('upsert', {
			firstName: 'Ada',
			email: ' ada@example.com ',
			phone: '',
			fieldData: '{"priority":"high"}',
			idempotencyKey: 'run-1',
		});
		assert.equal(call.method, 'POST');
		assert.equal(call.path, '/contacts/upsert');
		assert.deepEqual(call.body, {
			first_name: 'Ada',
			primary_email: 'ada@example.com',
			field_data: { priority: 'high' },
		});
		assert.deepEqual(call.headers, { 'Idempotency-Key': 'run-1' });
	});

	it('omits the idempotency header when the key is blank', () => {
		const call = callOf('create', { firstName: 'Ada', idempotencyKey: '  ' });
		assert.equal(call.path, '/contacts');
		assert.equal(call.headers, undefined);
	});

	it('rejects custom fields that are not a JSON object', () => {
		for (const raw of ['[', '[]']) {
			const built = buildContactCall('create', { fieldData: raw });
			assert.equal(isContactProblem(built), true);
			if (isContactProblem(built)) assert.match(built.problem, /JSON object/);
		}
	});

	it('lists with exact phone and email filters and drops an empty search', () => {
		const call = callOf('getAll', { query: '  ', filterPhone: '555', filterEmail: 'a@b.c', limit: 10, offset: 0 });
		assert.deepEqual(call.qs, { phone: '555', email: 'a@b.c', limit: 10 });
	});

	it('updates and reads one contact by id, and refuses a missing id', () => {
		assert.equal(callOf('update', { contactId: 'abc', leadStatus: 'Working' }).path, '/contacts/abc');
		assert.equal(callOf('getScore', { contactId: 'abc' }).path, '/contacts/abc/score');
		assert.equal(callOf('delete', { contactId: 'a/b' }).path, '/contacts/a%2Fb');
		const missing = buildContactCall('get', {});
		assert.equal(isContactProblem(missing), true);
		if (isContactProblem(missing)) assert.match(missing.problem, /Contact ID is required/);
	});

	it('loads the field list with no body', () => {
		assert.deepEqual(callOf('getFields', {}), { method: 'GET', path: '/contacts/fields' });
	});
});
