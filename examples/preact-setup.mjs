import { store, api } from "ustor";
import { batch, computed, effect, signal } from "@preact/signals-core";

// Configure once before creating stores. Applications normally put this in a
// small setup module imported by their entry point.
Object.assign(api, {
	signal,
	computed,
	effect,
	get: (/** @type {{ value: any }} */ value) => value.value,
	getComputed: (/** @type {{ value: any }} */ value) => value.value,
	set: (/** @type {{ value: any }} */ target, /** @type {any} */ value) => { target.value = value; },
	is: (/** @type {any} */ value) => typeof value?.peek === "function",
});

export { api, batch, computed, effect, signal, store };
