const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { gzipSync } = require("node:zlib");
const pkg = require("./package.json");

const exercise = (module) => {
	assert.equal(typeof module.store, "function");
	assert.equal(typeof module.is, "function");
	assert.equal(typeof module.api, "object");
	for (const key of Object.keys(module.api)) delete module.api[key];
	Object.assign(module.api, {
		signal: (value) => ({ value, signal: true }),
		get: (signal) => signal.value,
		set: (signal, value) => { signal.value = value; },
		is: (value) => value?.signal === true,
	});
	const state = module.store({
		a: 1,
		list: [1, 2],
		get total() { return this.a + this.list.reduce((sum, value) => sum + value, 0); },
	});
	assert.equal(state.total, 4);
	state.a = 2;
	state.list.push(3);
	assert.equal(state.total, 8);
	assert.equal(module.is(state), true);
	assert.equal(module.is({}), false);
};

(async () => {
	assert.equal(pkg.main, "./dist/index.cjs");
	assert.equal(pkg.exports["."].require, "./dist/index.cjs");
	assert.equal(pkg.exports["."].import, "./dist/index.es.js");
	assert.equal(pkg.exports["."].types, "./types/index.d.ts");
	assert.equal(pkg.exports["./react"].types, "./types/react.d.ts");
	assert.ok(fs.existsSync(path.join(__dirname, "types", "index.d.ts")));
	assert.ok(fs.existsSync(path.join(__dirname, "types", "react.d.ts")));

	exercise(require("ustor"));
	exercise(await import("ustor"));
	const reactCjs = require("ustor/react");
	const reactEsm = await import("ustor/react");
	assert.equal(typeof reactCjs.useSelector, "function");
	assert.equal(typeof reactEsm.useSelector, "function");
	assert.equal(reactCjs.useStore, undefined);
	assert.equal(reactCjs.useSignal, undefined);
	assert.equal(reactEsm.useStore, undefined);
	assert.equal(reactEsm.useSignal, undefined);

	const minified = fs.readFileSync(path.join(__dirname, "dist", "index.min.js"));
	assert.ok(minified.length <= 2048, `minified bundle exceeded 2 KiB: ${minified.length} bytes`);
	assert.ok(gzipSync(minified).length <= 1024, "gzipped bundle exceeded 1 KiB");

	for (const file of ["index.min.js", "index.umd.js"]) {
		const context = {};
		vm.runInNewContext(fs.readFileSync(path.join(__dirname, "dist", file), "utf8"), context);
		assert.equal(typeof context.ustor?.store, "function", `${file} must expose the ustor global`);
	}

	console.log("ESM, CommonJS, IIFE, and UMD package smoke tests passed.");
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
