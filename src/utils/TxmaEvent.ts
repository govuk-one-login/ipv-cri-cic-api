import { VerifiedCredential } from "./IVeriCredential";
import { ISessionItem } from "../models/ISessionItem";

export type TxmaEventName =
	"CIC_CRI_START"
	| "CIC_CRI_AUTH_CODE_ISSUED"
	| "CIC_CRI_END"
	| "CIC_CRI_VC_ISSUED";

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
	"evidence": Evidence;
}

export interface BaseTxmaEvent {
	"user": TxmaUser;
	"client_id": string;
	"timestamp": number;
	"event_timestamp_ms": number;
	"component_id": string;
}

export interface TxmaEvent extends BaseTxmaEvent {
	"event_name": TxmaEventName;
	"restricted"?: VerifiedCredential["credentialSubject"];
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
		client_id: session.clientId,
		timestamp: Math.floor(Date.now() / 1000),
		event_timestamp_ms: now,
		component_id: issuer,
	};
};
