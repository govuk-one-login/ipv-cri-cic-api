export class AppError extends Error {
	constructor(
		public message: string,
		public statusCode?: number,
		public code?: number,
	) {
		super(message);
	}
}

export class SessionNotFoundError extends AppError {
	constructor(id: string) {
		super(`Could not find session item with id: ${id}`);
		this.statusCode = 400; // check
		this.code = 1029;
	}
}
