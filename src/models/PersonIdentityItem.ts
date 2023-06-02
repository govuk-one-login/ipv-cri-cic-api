export interface PersonIdentityNamePart {
	type: string;
	value: string;
}

export interface PersonIdentityName {
	nameParts: PersonIdentityNamePart[];
}

export interface PersonIdentityAddress {
	uprn?: number;
	organisationName?: string;
	departmentName?: string;
	subBuildingName?: string;
	buildingNumber?: string;
	buildingName?: string;
	dependentStreetName?: string;
	streetName?: string;
	doubleDependentAddressLocality?: string;
	dependentAddressLocality?: string;
	addressLocality?: string;
	postalCode?: string;
	addressCountry?: string;
	validFrom?: string;
	validUntil?: string;
}

export interface PersonIdentityDateOfBirth {
	value: string;
}

export interface PersonIdentityItem {
	sessionId: string;
	addresses: PersonIdentityAddress[];
	personNames: PersonIdentityName[];
	birthDates: PersonIdentityDateOfBirth[];
	expiryDate: number;
}

// Used by /session to map shared_claims, converted into PersonIdentityItem
export interface SharedClaimsItem {
	name: PersonIdentityName[];
	birthDate: PersonIdentityDateOfBirth[];
	address: PersonIdentityAddress[];
}

// Used by /claimedIdentity to map user input from FE
export interface ICicSession {
	personNames: PersonIdentityName[];
	birthDates: PersonIdentityDateOfBirth[];
}


