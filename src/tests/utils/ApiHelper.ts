export function assertStatusCode(expectedStatus: number, status: number, statusText: string): void {
	expect(status).toBe(expectedStatus);
	if (expectedStatus === 200) {
		expect(statusText).toBe("OK");
	} else if (expectedStatus === 201) {
		expect(statusText).toBe("Created");
	} else if (expectedStatus === 400) {
		expect(statusText).toBe("Bad Request");
	} else if (expectedStatus === 401) {
		expect(statusText).toBe("Unauthorized");
	}  
}

export function post(apiInstance: any, path: string, data: any, header: any):Promise<any> {
	return apiInstance.post(`${path}`, data, header);
}

export function get(apiInstance: any, path: string, data: any):Promise<any> {
	return apiInstance.get(`${path}`, data);
}

export function assertResponseMessage(request: any, expectedValue: any):void {
	expect(request.data.message).toBe(expectedValue);
}

export function assertResponseData(request: any, expectedValue: any):void {
	expect(request.data).toBe(expectedValue);
}
