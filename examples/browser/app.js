import { store, api } from "ustor";
import { computed, effect, signal } from "@preact/signals-core";

Object.assign(api, {
	signal,
	computed,
	effect,
	get: (value) => value.value,
	getComputed: (value) => value.value,
	set: (target, value) => { target.value = value; },
	is: (value) => typeof value?.peek === "function",
});

const state = store({
	count: 0,
	items: [],
	get double() { return this.count * 2; },
});

const countOutput = document.querySelector("#count");
const itemsOutput = document.querySelector("#items");

effect(() => {
	countOutput.textContent = `Count: ${state.count}; double: ${state.double}`;
});
effect(() => {
	itemsOutput.textContent = `Items: ${state.items.join(", ") || "none"}`;
});

document.querySelector("#increment").addEventListener("click", () => state.count++);
document.querySelector("#add-item").addEventListener("click", () => state.items.push(state.count));
