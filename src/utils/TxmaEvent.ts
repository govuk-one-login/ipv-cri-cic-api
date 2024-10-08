import { CredentialSubject } from "./IVeriCredential";
import { ISessionItem } from "../models/ISessionItem";

export type TxmaEventName =
	"CIC_CRI_START"
	| "CIC_CRI_AUTH_CODE_ISSUED"
	| "CIC_CRI_END"
	| "CIC_CRI_VC_ISSUED"
	| "CIC_CRI_SESSION_ABORTED";

export interface TxmaUser {
	"user_id": string;
	"transaction_id": string;
	"persistent_session_id": string;
	"session_id": string;
	"govuk_signin_journey_id": string;
	"ip_address"?: string | undefined;
}

export interface Evidence {
	"context": string;
}

export interface Extensions {
	"evidence": [Evidence];
}

export interface TxMACredentialSubject extends CredentialSubject {
	device_information?: {
		encoded: string;
	};
}

export interface TxMAVerifiedCredential {
	"@context": string[];
	type: string[];
	credentialSubject: TxMACredentialSubject;
}

export interface BaseTxmaEvent {
	"user": TxmaUser;
	"timestamp": number;
	"event_timestamp_ms": number;
	"component_id": string;
}

export interface TxmaEvent extends BaseTxmaEvent {
	"event_name": TxmaEventName;
	"restricted"?: TxMAVerifiedCredential["credentialSubject"];
	"extensions"?: Extensions;
}

export const buildCoreEventFields = (
	session: ISessionItem,
	issuer: string,
	sourceIp?: string | undefined,
): BaseTxmaEvent => {
	const now = Date.now();

	return {
		user: {
			user_id: session.subject,
			persistent_session_id: session.persistentSessionId,
			transaction_id: "",
			session_id: session.sessionId,
			govuk_signin_journey_id: session.clientSessionId,
			ip_address: sourceIp,
		},
		timestamp: Math.floor(Date.now() / 1000),
		event_timestamp_ms: now,
		component_id: issuer,
	};
};
