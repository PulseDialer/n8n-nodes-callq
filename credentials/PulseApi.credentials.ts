import {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PulseApi implements ICredentialType {
	name = 'pulseApi';
	displayName = 'Pulse API';
	icon: Icon = { light: 'file:../nodes/Pulse/pulse.svg', dark: 'file:../nodes/Pulse/pulse.dark.svg' };
	documentationUrl = 'https://github.com/PulseDialer/n8n-nodes-callq';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://dialer.timesharehelpcenter.com',
			required: true,
			description: 'The Pulse site, with no path. Change this only if the CRM is served from another host.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Starts with plk_. Create it under Admin → Platform → API Keys. It is shown once.',
		},
		{
			displayName: 'Webhook Signing Secret',
			name: 'webhookSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Starts with whsec_. Shown once when you create the webhook subscription. The Pulse Trigger refuses deliveries without it.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/v1/public/me',
		},
	};
}
