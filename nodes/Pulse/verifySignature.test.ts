import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verifyPulseSignature } from './verifySignature.ts';

const SECRET = 'whsec_test';
const BODY = '{"event":"lead.created","id":"evt-1"}';
const NOW = 1_700_000_000;

function headerFor(body: string, secret: string, timestamp: number): string {
	const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
	return `t=${timestamp},v1=${v1}`;
}

describe('verifyPulseSignature', () => {
	it('accepts a signature over the raw body', () => {
		assert.deepEqual(verifyPulseSignature(BODY, headerFor(BODY, SECRET, NOW), SECRET, NOW), { ok: true });
	});

	it('rejects a different secret', () => {
		const result = verifyPulseSignature(BODY, headerFor(BODY, SECRET, NOW), 'whsec_other', NOW);
		assert.equal(result.ok, false);
		if (!result.ok) assert.equal(result.reason, 'signature_mismatch');
	});

	it('rejects a body that was changed after signing', () => {
		const result = verifyPulseSignature(BODY + ' ', headerFor(BODY, SECRET, NOW), SECRET, NOW);
		assert.equal(result.ok, false);
	});

	it('rejects a timestamp older than five minutes', () => {
		const result = verifyPulseSignature(BODY, headerFor(BODY, SECRET, NOW - 301), SECRET, NOW);
		assert.deepEqual(result, { ok: false, reason: 'signature_stale' });
	});

	it('rejects a missing secret, header, or v1', () => {
		assert.deepEqual(verifyPulseSignature(BODY, headerFor(BODY, SECRET, NOW), '', NOW), {
			ok: false,
			reason: 'signing_secret_missing',
		});
		assert.deepEqual(verifyPulseSignature(BODY, undefined, SECRET, NOW), {
			ok: false,
			reason: 'signature_missing',
		});
		assert.deepEqual(verifyPulseSignature(BODY, `t=${NOW}`, SECRET, NOW), {
			ok: false,
			reason: 'signature_malformed',
		});
	});

	it('rejects a signature of a different length without throwing', () => {
		assert.deepEqual(verifyPulseSignature(BODY, `t=${NOW},v1=abcd`, SECRET, NOW), {
			ok: false,
			reason: 'signature_mismatch',
		});
	});
});
