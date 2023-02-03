export class AppError extends Error {
	constructor(
		public message: string,
		public statusCode: number
	) {
		super(message);
	}
}

export class SessionNotFoundError extends AppError {
	constructor(id: string) {
		super(`Could not find session item with id: ${id}`, 400);
	}
}
