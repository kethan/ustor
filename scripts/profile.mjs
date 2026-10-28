import { performance } from "node:perf_hooks";
import { batch, computed, effect, signal } from "@preact/signals-core";
import { api, store } from "../src/index.js";

Object.assign(api, {
	signal,
	computed,
	getComputed: (value) => value.value,
	get: (value) => value.value,
	set: (target, value) => { target.value = value; },
	is: (value) => typeof value?.peek === "function",
});

const args = process.argv.slice(2);
const numberOption = (name, fallback) => {
	const argument = args.find((value) => value.startsWith(`--${name}=`));
	if (!argument) return fallback;
	const value = Number(argument.slice(name.length + 3));
	if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid --${name}: ${argument}`);
	return value;
};

const options = {
	updates: numberOption("updates", 200_000),
	arrayUpdates: numberOption("array-updates", 25_000),
	batchSize: Math.max(1, numberOption("batch-size", 100)),
	seconds: numberOption("seconds", 30),
	cycles: numberOption("cycles", Number.POSITIVE_INFINITY),
	sampleMs: Math.max(1, numberOption("sample-ms", 1000)),
	json: args.includes("--json"),
};

if (options.cycles === 0) options.cycles = Number.POSITIVE_INFINITY;

const checksum = { value: 0 };
const collectGarbage = () => {
	if (globalThis.gc) {
		globalThis.gc();
		globalThis.gc();
	}
};
const memorySample = (elapsedMs) => {
	collectGarbage();
	const memory = process.memoryUsage();
	return { elapsedMs: Math.round(elapsedMs), heapUsed: memory.heapUsed, rss: memory.rss };
};
const rate = (operations, durationMs) => Math.round(operations / (durationMs / 1000));
const formatBytes = (value) => `${value < 0 ? "-" : ""}${(Math.abs(value) / 1024 / 1024).toFixed(2)} MiB`;

const propertyBenchmark = (operations, batchSize = 1) => {
	const state = store({ value: 0, get double() { return this.value * 2; } });
	let observed = 0;
	const dispose = effect(() => { observed = state.double; });
	const start = performance.now();
	if (batchSize === 1) {
		for (let i = 0; i < operations; i++) state.value = i;
	} else {
		for (let i = 0; i < operations; i += batchSize) {
			batch(() => {
				for (let j = 0; j < batchSize; j++) state.value = i + j;
			});
		}
	}
	const durationMs = performance.now() - start;
	dispose();
	checksum.value += observed;
	return { operations, durationMs, operationsPerSecond: rate(operations, durationMs) };
};

const arrayBenchmark = (operations) => {
	const state = store({ list: [] });
	let observed = 0;
	const dispose = effect(() => { observed = state.list.length + (state.list[0] ?? 0); });
	const start = performance.now();
	for (let i = 0; i < operations; i++) {
		state.list.push(i);
		if (state.list.length > 32) state.list.shift();
		state.list[0] = i;
	}
	const durationMs = performance.now() - start;
	dispose();
	checksum.value += observed;
	return { operations, durationMs, operationsPerSecond: rate(operations, durationMs) };
};

const memoryProfile = () => {
	const start = performance.now();
	const samples = [memorySample(0)];
	let cycles = 0;
	let nextSample = options.sampleMs;
	while (performance.now() - start < options.seconds * 1000 && cycles < options.cycles) {
		for (let i = 0; i < 100 && cycles < options.cycles; i++) {
			const state = store({
				value: 0,
				nested: { value: 1 },
				list: [1, 2, 3],
				get total() { return this.value + this.nested.value + this.list.length; },
			});
			let observed = 0;
			const dispose = effect(() => { observed = state.total; });
			for (let update = 0; update < 10; update++) {
				state.value = update;
				state.nested.value = update + 1;
				state.list.push(update);
				state.list.shift();
			}
			dispose();
			checksum.value += observed;
			cycles++;
		}
		const elapsed = performance.now() - start;
		if (elapsed >= nextSample || cycles >= options.cycles) {
			samples.push(memorySample(elapsed));
			nextSample = elapsed + options.sampleMs;
		}
	}
	const finalSample = memorySample(performance.now() - start);
	if (samples.at(-1) !== finalSample) samples.push(finalSample);
	return {
		durationMs: performance.now() - start,
		cycles,
		samples,
		heapDelta: samples.at(-1).heapUsed - samples[0].heapUsed,
		rssDelta: samples.at(-1).rss - samples[0].rss,
	};
};

// Warm up JIT and reactive graph creation before measuring.
propertyBenchmark(1000);
arrayBenchmark(100);
const benchmarks = {
	property: propertyBenchmark(options.updates),
	batchedProperty: propertyBenchmark(options.updates, options.batchSize),
	array: arrayBenchmark(options.arrayUpdates),
};
const memory = memoryProfile();
const report = {
	adapter: "@preact/signals-core",
	node: process.version,
	gcAvailable: typeof globalThis.gc === "function",
	benchmarks,
	memory,
	checksum: checksum.value,
};

if (options.json) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`UStor profile | ${report.adapter} | Node ${report.node}`);
	console.log(`GC available: ${report.gcAvailable}`);
	for (const [name, result] of Object.entries(benchmarks)) {
		console.log(`${name}: ${result.operationsPerSecond.toLocaleString()} ops/s (${result.durationMs.toFixed(1)} ms)`);
	}
	console.log(`Memory: ${memory.cycles.toLocaleString()} create/update/dispose cycles in ${(memory.durationMs / 1000).toFixed(1)} s`);
	console.table(memory.samples.map((sample) => ({
		seconds: (sample.elapsedMs / 1000).toFixed(1),
		heapUsed: formatBytes(sample.heapUsed),
		rss: formatBytes(sample.rss),
	})));
	console.log(`Retained heap delta: ${formatBytes(memory.heapDelta)}; RSS delta: ${formatBytes(memory.rssDelta)}`);
	console.log(`Checksum: ${report.checksum}`);
}
