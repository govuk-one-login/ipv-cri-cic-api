"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assert401Unauthorized = exports.assert400BadRequest = exports.assert201Created = exports.assert200OK = void 0;
function assert200OK(status, statusText) {
    expect(status).toBe(200);
    expect(statusText).toBe("OK");
}
exports.assert200OK = assert200OK;
function assert201Created(status, statusText) {
    expect(status).toBe(201);
    expect(statusText).toBe("Created");
}
exports.assert201Created = assert201Created;
function assert400BadRequest(status, statusText) {
    expect(status).toBe(400);
    expect(statusText).toBe("Bad Request");
}
exports.assert400BadRequest = assert400BadRequest;
function assert401Unauthorized(status, statusText) {
    expect(status).toBe(401);
    expect(statusText).toBe("Unauthorized");
}
exports.assert401Unauthorized = assert401Unauthorized;
