# UStor

[![tests](https://github.com/kethan/ustor/actions/workflows/node.js.yml/badge.svg)](https://github.com/kethan/ustor/actions/workflows/node.js.yml)
[![Version](https://img.shields.io/npm/v/ustor.svg?color=success&style=flat-square)](https://www.npmjs.com/package/ustor)
[![Bundle size](https://deno.bundlejs.com/badge?q=ustor&treeshake=[*]&config={%22compression%22:%22brotli%22})](https://bundlejs.com/?q=ustor)

A tiny, dependency-free reactive store for JavaScript objects and arrays. UStor uses your signal implementation instead of bundling a reactivity engine.

- **Small:** about 1.8 KiB minified and less than 1 KiB gzipped.
- **Deeply reactive:** nested objects, arrays, getters, and existing signals.
- **Framework-friendly:** 16 tested signal/store adapters plus optional React hooks.
- **SSR-ready:** server rendering and hydration are tested.
- **Typed:** TypeScript declarations for the core and React entry points.
- **Interoperable:** ESM, CommonJS, IIFE, and UMD builds.

## Contents

- [Installation](#installation)
- [Quickstart](#quickstart)
- [Common use cases](#common-use-cases)
- [API reference](#api-reference)
- [Arrays](#arrays)
- [Supported adapters](#supported-adapters)
- [Porting any signal library](#porting-any-signal-library)
- [React](#react)
- [SSR and Next.js](#ssr-and-nextjs)
- [TypeScript](#typescript)
- [Profiling and memory analysis](#profiling-and-memory-analysis)
- [Production notes](#production-notes)
- [Development](#development)

## Installation

```bash
npm install ustor
```

Install the signal library you want to use. The examples below use `@preact/signals-core`:

```bash
npm install @preact/signals-core
```

UStor targets modern JavaScript environments with `Proxy`, `Reflect`, `WeakMap`, and `Object.hasOwn`. The runtime is not transpiled or polyfilled for legacy browsers.

## Quickstart

Configure the adapter once, before creating stores:

```javascript
import { store, api } from "ustor";
import { signal, computed, effect } from "@preact/signals-core";

Object.assign(api, {
	signal,
	memo: computed,
	effect,
	get: (value) => value.value,
	getMemo: (value) => value.value,
	set: (target, value) => { target.value = value; },
	is: (value) => typeof value?.peek === "function",
});
```

Create a store and use ordinary property reads and writes:

```javascript
const state = store({
	count: 1,
	items: [1, 2],
	get double() {
		return this.count * 2;
	},
});

const dispose = effect(() => {
	console.log(state.double, state.items.length);
});

state.count = 3;       // effects using count or double update
state.items.push(3);   // array mutations are reactive too

console.log(state.count);        // 3
console.log(state.double);       // 6
console.log(state.$count.value); // 3: the underlying Preact signal

dispose();
```

**Important:** `api` is shared by stores from the same UStor module instance. Configure one adapter and do not switch implementations while existing stores are still in use.

## Common use cases

### Shopping cart with reactive items and totals

```javascript
const cart = store({
	items: [],
	get total() {
		return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
	},
});

cart.items.push({ id: "book", price: 12, quantity: 1 });
console.log(cart.total); // 12

cart.items[0].quantity = 2;
console.log(cart.total); // 24

cart.items.push({ id: "pen", price: 2, quantity: 3 });
console.log(cart.total); // 30
```

Objects inserted into arrays become reactive stores. Their existing fields can be updated, while their object schema remains sealed.

### Form state with derived validation

```javascript
const form = store({
	email: "",
	password: "",
	get valid() {
		return this.email.includes("@") && this.password.length >= 8;
	},
});

form.email = "person@example.com";
form.password = "very-secret";
console.log(form.valid); // true
```

Use an effect or a UI binding to react to `form.valid`; reading it manually always returns the current value.

### Shared UI state

```javascript
const ui = store({
	theme: "light",
	sidebar: { open: false },
	notifications: [],
});

ui.sidebar.open = true;
ui.notifications.push({ id: 1, message: "Saved" });
ui.theme = "dark";
```

Create request- or component-specific stores when the state must not be shared. See [SSR and Next.js](#ssr-and-nextjs).

## API reference

### `store(values, proto?)`

Creates and returns a reactive object or array store.

```javascript
const state = store({ nested: { value: 1 } });
state.nested.value = 2;
```

Behavior:

- Existing object properties become signal-backed accessors.
- Nested objects and arrays are recursively converted.
- Existing stores are returned unchanged.
- Repeated and cyclic references preserve identity.
- `proto` optionally replaces the new object store's prototype.
- Primitives, including `null` and `undefined`, are returned unchanged.
- Class instances, dates, maps, sets, and similar objects are treated as atomic values.
- Calling `store` for an object or array before configuring the required adapter throws an error.

Object stores have a **sealed schema**. Adding or deleting object properties is unsupported; replace the containing object when its shape must change. Arrays remain structurally mutable.

```javascript
const state = store({ profile: { name: "Ada" } });

// Instead of adding a new field to profile:
state.profile = { name: "Ada", active: true };
```

### `is(value)`

Returns `true` for a reactive store and `false` for every other value.

```javascript
is(state);   // true
is({});      // false
is(null);    // false
```

### `state.$property`

Exposes the underlying signal for a data property, or the underlying memo for a memoized getter.

```javascript
const state = store({ count: 0 });

state.$count.value = 2; // Preact signal example
console.log(state.count); // 2
```

Aliases are non-enumerable. Getters without `api.memo` do not have a `$` alias. If an input explicitly defines a conflicting key such as `$count`, the user-defined property takes precedence.

### Adapter API

Required operations:

| Operation | Purpose |
| --- | --- |
| `api.signal(value)` | Create a signal. |
| `api.get(signal)` | Read its current value. |
| `api.set(signal, value)` | Update its value. |
| `api.is(value)` | Detect an existing signal without misclassifying ordinary functions or objects. |

Optional operations:

| Operation | Purpose |
| --- | --- |
| `api.memo(fn)` | Create a lazy computed value. |
| `api.getMemo(memo)` | Read a memo; defaults to `api.get`. |
| `api.effect(fn)` | Required by `ustor/react`; must auto-track synchronously and return a cleanup function. |

Without `api.memo`, getters execute on each access and still participate in compatible effects. With `api.memo`, getters are lazy and cached while their dependencies remain unchanged.

## Arrays

Arrays are proxies over their mutable input target. Mutate the returned store, not the original input, to send notifications.

```javascript
const state = store({ list: [1, 2, 3] });

state.list[1] = 5;
state.list.push(4);
state.list.splice(0, 1);
state.list.length = 2;
delete state.list[0];
```

Tracked operations include:

- Index assignment and whole-array replacement.
- `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, and `copyWithin`.
- Length changes and `delete`.
- Iteration, key enumeration, and the `in` operator.
- Objects inserted by assignment or mutating methods.
- Sparse arrays and nullish entries.

Each standard mutating method emits at most one notification after it finishes. Deterministic model tests compare randomized mutation sequences against native arrays.

## Supported adapters

The configurations in `adapters.spec.js` are executable documentation and include lifecycle scopes where appropriate.

| Package | Getter support |
| --- | --- |
| `@preact/signals-core` | Automatic memoization |
| `solid-js` | Automatic memoization |
| `oby` | Automatic memoization |
| `sinuous/observable` | Automatic memoization |
| `ulive` | Automatic memoization |
| `usignal` | Automatic memoization |
| `@vue/reactivity` | Automatic memoization using `shallowRef` |
| `alien-signals` | Automatic memoization |
| `s-js` | Automatic memoization using the provided branded factory |
| `mobx` | Automatic memoization using shallow observable boxes |
| `@tanstack/store` | Automatic memoization using the provided value wrapper |
| `@webreflection/signal` | Automatic memoization |
| `@webreflection/signals` | Automatic memoization |
| `@webreflection/alien-signals` | Automatic memoization |
| `rxjs` | Basic: `BehaviorSubject` values and direct getters |
| `nanostores` | Basic: atoms and direct getters |

**Basic adapters** support synchronous values, nested objects, arrays, and getters evaluated on access. RxJS and Nanostores do not automatically discover arbitrary getter dependencies, so automatic memoization is not advertised for them.

Adapter-specific notes:

- Vue and MobX use shallow containers to avoid wrapping UStor's proxies twice.
- TanStack Store treats bare functions as computed values; its tested adapter wraps writable values.
- S.js has no built-in signal brand; use the tested factory and create memoized stores inside an S.js root.
- Solid.js, Vue, S.js, and similar libraries may require their own owner/scope lifecycle for short-lived memos.

## Porting any signal library

You normally **do not need to modify UStor's core**. Port a library by translating its synchronous read/write API into four required functions, then add optional memo/effect functions when supported.

### 1. Map the four required operations

Use this template and replace the example method names with your library's API:

```javascript
import { store, api } from "ustor";
import * as library from "your-signal-library";

Object.assign(api, {
	// Create a container that can hold any value.
	signal: (value) => library.create(value),

	// Return the current value synchronously.
	get: (signal) => library.read(signal),

	// Store this exact value and notify synchronously.
	set: (signal, value) => library.write(signal, value),

	// Return true only for signals from this library.
	is: (value) => library.isSignal(value),
});
```

For a `.value`-based library, the mapping usually looks like this:

```javascript
Object.assign(api, {
	signal: (value) => library.create(value),
	get: (signal) => signal.value,
	set: (signal, value) => { signal.value = value; },
	is: (value) => value instanceof library.Signal,
});
```

For a callable-signal library:

```javascript
Object.assign(api, {
	signal: (value) => library.create(value),
	get: (signal) => signal(),
	set: (signal, value) => signal(value),
	is: (value) => typeof value === "function" && library.isSignal(value),
});
```

If the setter expects an updater rather than a direct value, adapt it explicitly:

```javascript
api.set = (signal, value) => signal.setState(() => value);
```

### 2. Preserve values without double-wrapping

`api.signal` must be able to store `null`, `undefined`, functions, arrays, objects, and UStor proxies.

- Use a **shallow** signal/ref/box when the library offers one.
- Do not make the contained object deeply observable a second time.
- Do not call a function merely because it was stored as a value.
- If a library interprets a function argument as a computed getter, place the value inside a shallow container or use the tested wrapper pattern from `adapters.spec.js`.

For example, the Vue adapter uses `shallowRef`, and the MobX adapter uses `observable.box(value, { deep: false })`.

### 3. Make `api.is` a precise brand check

A broad check can turn ordinary values into signals accidentally. Prefer `instanceof`, a library-provided brand check, or a documented marker.

```javascript
// Risky for callable-signal libraries: ordinary functions are values too.
api.is = (value) => typeof value === "function"; // Do not use this by itself.
```

If the library has no brand, create signals through a factory and track them in a `WeakSet`:

```javascript
const signals = new WeakSet();

api.signal = (value) => {
	const signal = library.create(value);
	signals.add(signal);
	return signal;
};

api.is = (value) => signals.has(value);
```

Create external signals through `api.signal` when using this approach. The S.js configuration in `adapters.spec.js` demonstrates it.

### 4. Add memoization only when dependencies are automatic

If the library can compute a value by automatically tracking signals read inside `fn`, add:

```javascript
Object.assign(api, {
	memo: (fn) => library.computed(fn),
	getMemo: (memo) => library.read(memo),
});
```

The memo may be lazy or eager, but it must invalidate when any dependency changes, including conditional dependencies.

If the library requires an explicit dependency list—as with RxJS or Nanostores—**omit `memo` and `getMemo`**. UStor then uses direct getters evaluated on access. Do not emulate automatic memoization incorrectly.

### 5. Add effects for React integration only when compatible

`ustor/react` requires this additional contract:

```javascript
api.effect = (fn) => {
	const dispose = library.effect(fn);
	return () => dispose(); // Always return a cleanup function.
};
```

A compatible effect must:

1. Run `fn` and automatically track its synchronous signal reads.
2. Rerun synchronously after a dependency changes.
3. Return a cleanup function, or be wrapped in an owner/root that provides one.

The core store does not require `api.effect`. Basic adapters without automatic dependency discovery can still provide ordinary state reads and writes.

### 6. Configure once and manage lifecycle

Configure `api` before creating stores and keep the same implementation for their lifetime. If your library requires an owner, scope, root, or disposer for memos/effects, create short-lived stores in that lifecycle and dispose them with their owner.

### 7. Validate the adapter

This Node script checks the required behavior, function preservation, nested updates, arrays, and optional memoization:

```javascript
import assert from "node:assert/strict";
import { store, api } from "ustor";
// Configure your adapter before these assertions.

const external = api.signal(1);
const state = store({
	value: external,
	nested: { count: 2 },
	list: [1, 2],
	fn: () => 7,
	get total() {
		return this.nested.count + this.list.reduce((sum, value) => sum + value, 0);
	},
});

assert.equal(state.value, 1);
assert.equal(state.$value, external);
assert.equal(state.fn(), 7); // The function remains a value.

state.value = 3;
assert.equal(api.get(external), 3);

state.nested.count = 4;
assert.equal(state.total, 7);

state.list.push(4);
assert.equal(state.total, 11);

state.list[0] = 5;
assert.equal(state.total, 15);

if (api.memo) {
	assert.equal((api.getMemo || api.get)(state.$total), 15);
}
```

A production-quality adapter should also verify:

- Whole-array replacement, deletion, and length changes.
- Conditional memo dependencies and no-op writes.
- Effect cleanup and behavior under nested/batched updates.
- React StrictMode and unmount behavior when used with `ustor/react`.
- Owner/scope disposal and long-running memory behavior.
- The library's ESM and CommonJS entry points in your target bundler.

For working examples, copy the closest configuration from `adapters.spec.js`, then run:

```bash
npm test
npm run test:coverage
npm run profile
```

## React

Install React and import the optional hooks:

```bash
npm install react
```

```jsx
import { useSignal, useStore } from "ustor/react";

// Uses the Preact configuration from Quickstart, including api.effect.
const state = store({ count: 1, items: [1, 2] });
const selectTotal = () => state.items.reduce((sum, value) => sum + value, 0);

export function Counter() {
	const count = useSignal(state.$count);
	const total = useStore(selectTotal);

	return (
		<button onClick={() => { state.count++; state.items.push(state.count); }}>
			{count} / {total}
		</button>
	);
}
```

- `useSignal(signal)` subscribes to one `$property` signal.
- `useStore(selector)` tracks all compatible signal reads in the selector, including array versions.
- Selectors must return a primitive or stable reference, not a fresh object on every read.
- Keep selector functions stable with `useCallback` when they are created inside a component.
- React is an optional peer dependency and is excluded from the core bundle.
- StrictMode and unmount cleanup are tested.

Plain property reads do not schedule React renders by themselves; use the hooks or another React binding.

## SSR and Next.js

Yes. `useStore` and `useSignal` provide a server snapshot through `useSyncExternalStore`. Server rendering creates no effects; subscriptions start on the client.

The test suite verifies:

- Server rendering without `api.effect`.
- Independent per-request stores.
- Hydration without markup mismatches.
- Reactive updates after hydration.

### Next.js App Router example

Use the hooks in a **Client Component**. Create request- or component-owned state instead of exporting a request-specific singleton.

```jsx
"use client";

import { useCallback, useState } from "react";
import { store } from "ustor";
import { useSignal, useStore } from "ustor/react";
// Import your shared adapter configuration once:
// import "@/lib/ustor-setup";

export default function Counter({ initialCount }) {
	const [state] = useState(() => store({
		count: initialCount,
		items: [1, 2],
	}));
	const selectTotal = useCallback(
		() => state.items.reduce((sum, value) => sum + value, 0),
		[state],
	);
	const count = useSignal(state.$count);
	const total = useStore(selectTotal);

	return (
		<button onClick={() => { state.count++; state.items.push(1); }}>
			{count} / {total}
		</button>
	);
}
```

```jsx
// app/page.jsx
import Counter from "./Counter";

export default function Page() {
	return <Counter initialCount={1} />;
}
```

SSR requirements:

1. Use `"use client"` for components that call the hooks.
2. Pass the same serializable initial props during server rendering and hydration.
3. Do not mutate the rendered state between its server snapshot and initial hydration.
4. Do not store request-specific data in a module-level singleton shared by server requests.
5. UStor does not provide a dehydration format. Serialize and restore initial data with your framework when needed.
6. Configure `api.effect` for client hydration even though it is not used during server rendering.

The repository tests use `react-dom/server` and `hydrateRoot`, the same underlying React SSR primitives used by Next.js Client Components.

## TypeScript

Declarations are included for both entry points; no separate `@types/ustor` package is needed.

```typescript
import { store } from "ustor";
import { useStore } from "ustor/react";

const state = store({
	count: 1,
	nested: { text: "hello" },
	list: [1, 2],
	get double() { return this.count * 2; },
});

state.count = 2;             // valid
// state.count = "invalid";  // TypeScript error

const doubled: number = state.double;
const text: string = state.nested.text;
const total = useStore(() => state.list.reduce((sum, value) => sum + value, 0));
```

Exported type utilities:

- `SignalApi<Signal, Memo>` for custom adapters.
- `Store<T>` for reactive store inference.
- `SignalValue<Signal>` for React signal-value inference.

Run the repository's strict compile-time tests with:

```bash
npm run typecheck
```

## Profiling and memory analysis

The profiler uses Preact Signals and measures:

- High-frequency memoized property updates.
- Batched property updates.
- Bounded array mutation workloads.
- Repeated store/effect creation, updates, and disposal with heap/RSS samples.

Run a short smoke profile:

```bash
npm run profile:smoke
```

Run the default 30-second memory profile:

```bash
npm run profile
```

Run a longer custom profile:

```bash
npm run profile -- --updates=1000000 --array-updates=100000 --seconds=60 --sample-ms=1000
```

Write machine-readable output:

```bash
npm run --silent profile -- --json --seconds=30 > profile.json
```

Profiling guidelines:

- Run with the same Node version and workload characteristics as production.
- Compare several samples after warm-up and forced GC, not one heap reading.
- A flat retained-heap trend is more useful than a single delta.
- RSS can grow early and plateau because of allocator behavior; RSS alone does not prove a leak.
- The CI smoke profile checks that the profiler remains runnable, not that every workload is leak-free.
- Repeat equivalent profiling with the adapter and application workload you actually deploy.

## Production notes

- Use one adapter per UStor module instance and keep it for the lifetime of existing stores.
- Dispose adapter owners/scopes and UI subscriptions for short-lived stores.
- Test your actual browser, bundler, SSR, and hydration path.
- Stress-test application-specific update patterns and long-running memory usage.
- Use basic RxJS/Nanostores adapters only where their direct-getter semantics are sufficient.
- Keep runtime and development artifacts separate; `dist` and declarations are the only published implementation files.

### Release checklist

The repository already checks unit and adapter behavior, TypeScript declarations, React, SSR/hydration, package formats, bundle size, coverage, and dependency audit status.

Before publishing a production release:

1. **Choose a new version and write release notes.** The changes since the original `0.1.0` include observable behavior changes. Do not publish them as the same version; use an appropriate new version and document getter, sealed-object, array-proxy, and packaging behavior.
2. **Test the packed artifact in a clean consumer application.** Run your real bundler and framework against the tarball rather than only against repository source.
3. **Exercise your production SSR path.** The generic React SSR primitives are tested, but a full Next.js or other framework application should verify its own rendering, dehydration, and hydration flow.
4. **Run target-browser and production-adapter checks.** Repeat performance and long-running memory profiling with the adapter and workload you deploy.
5. **Review the release artifact.** Confirm `npm pack --dry-run`, `npm audit`, the package entry points, declaration files, license, and version before tagging or publishing.

## Development

```bash
npm ci
npm test                 # build, type tests, unit/adapter/React/SSR tests, package smoke tests
npm run typecheck        # strict TypeScript declaration tests
npm run test:coverage    # enforced 100% runtime coverage
npm run test:watch
npm run profile:smoke
npm run build
```

The core size budget is enforced at 2 KiB minified and 1 KiB gzipped. `dist` is generated during build/prepack; declarations are published from `types/`.

## License

[MIT](./LICENSE)

## Thanks and inspiration

- [dy](https://github.com/dy)
