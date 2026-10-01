// HMAC check for Pulse outbound webhooks. The signed string is
// `${timestamp}.${rawBody}` with the subscription secret, matching
// docs/platform-api.md. Verify the raw body, never a re-serialized object.

import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_SKEW_SECONDS = 300;

export type SignatureResult = { ok: true } | { ok: false; reason: string };

export function verifyPulseSignature(
	rawBody: string,
	header: string | undefined,
	secret: string,
	nowSeconds: number = Date.now() / 1000,
): SignatureResult {
	if (!secret) return { ok: false, reason: 'signing_secret_missing' };
	if (!header) return { ok: false, reason: 'signature_missing' };
	const parts = Object.fromEntries(
		header.split(',').map((kv) => {
			const idx = kv.indexOf('=');
			return idx === -1 ? [kv, ''] : [kv.slice(0, idx), kv.slice(idx + 1)];
		}),
	);
	const timestamp = parts.t;
	const given = parts.v1;
	if (!timestamp || !given) return { ok: false, reason: 'signature_malformed' };
	const sentAt = Number(timestamp);
	if (!Number.isFinite(sentAt)) return { ok: false, reason: 'signature_malformed' };
	if (Math.abs(nowSeconds - sentAt) > MAX_SKEW_SECONDS) return { ok: false, reason: 'signature_stale' };
	const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
	const expectedBuf = Buffer.from(expected);
	const givenBuf = Buffer.from(given);
	if (expectedBuf.length !== givenBuf.length) return { ok: false, reason: 'signature_mismatch' };
	if (!timingSafeEqual(expectedBuf, givenBuf)) return { ok: false, reason: 'signature_mismatch' };
	return { ok: true };
}
