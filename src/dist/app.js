(() => { const e = class {async handler (t, r) { return console.log('Hello world!'), { statusCode: 200, body: 'Hello world' } }}; const a = new e(); const l = a.handler.bind(a) })()
// # sourceMappingURL=app.js.map
