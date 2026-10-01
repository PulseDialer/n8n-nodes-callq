import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildContactCall } from './contactRequest.ts';

describe('buildContactCall', () => {
	it('upserts with only the fields that were filled in, and sends the idempotency key', () => {
		const call = buildContactCall('upsert', {
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
		const call = buildContactCall('create', { firstName: 'Ada', idempotencyKey: '  ' });
		assert.equal(call.path, '/contacts');
		assert.equal(call.headers, undefined);
	});

	it('rejects custom fields that are not a JSON object', () => {
		assert.throws(() => buildContactCall('create', { fieldData: '[' }), /JSON object/);
		assert.throws(() => buildContactCall('create', { fieldData: '[]' }), /JSON object/);
	});

	it('lists with exact phone and email filters and drops an empty search', () => {
		const call = buildContactCall('getAll', { query: '  ', filterPhone: '555', filterEmail: 'a@b.c', limit: 10, offset: 0 });
		assert.deepEqual(call.qs, { phone: '555', email: 'a@b.c', limit: 10 });
	});

	it('updates and reads one contact by id, and refuses a missing id', () => {
		assert.equal(buildContactCall('update', { contactId: 'abc', leadStatus: 'Working' }).path, '/contacts/abc');
		assert.equal(buildContactCall('getScore', { contactId: 'abc' }).path, '/contacts/abc/score');
		assert.equal(buildContactCall('delete', { contactId: 'a/b' }).path, '/contacts/a%2Fb');
		assert.throws(() => buildContactCall('get', {}), /Contact ID is required/);
	});

	it('loads the field list with no body', () => {
		assert.deepEqual(buildContactCall('getFields', {}), { method: 'GET', path: '/contacts/fields' });
	});
});
