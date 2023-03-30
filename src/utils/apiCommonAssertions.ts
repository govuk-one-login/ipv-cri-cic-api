export function assert200OK({ status, statusText }: { status: number; statusText: string }): void {
	expect(status).toBe(200);
	expect(statusText).toBe("OK");
}
export function assert201Created({ status, statusText }: { status: number; statusText: string }): void {
	expect(status).toBe(201);
	expect(statusText).toBe("Created");
}

export function assert400BadRequest({ status, statusText }: { status: number; statusText: string }): void {
	expect(status).toBe(400);
	expect(statusText).toBe("Bad Request");
}

export function assert401Unauthorized({ status, statusText }: { status: number; statusText: string }): void {
	expect(status).toBe(401);
	expect(statusText).toBe("Unauthorized");
}
