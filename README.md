# UStor

[![tests](https://github.com/kethan/ustor/actions/workflows/node.js.yml/badge.svg)](https://github.com/ustor/actions/workflows/node.js.yml) [![Version](https://img.shields.io/npm/v/ustor.svg?color=success&style=flat-square)](https://www.npmjs.com/package/ustor) [![Badge size](https://deno.bundlejs.com/badge?q=ustor&treeshake=[*]&config={"compression":"brotli"})](https://unpkg.com/ustor) [![Badge size](https://deno.bundlejs.com/badge?q=ustor&treeshake=[*]&config={"compression":"gzip"})](https://unpkg.com/ustor)

# Reactive Store Library

This library provides a powerful reactivity system for creating stateful objects using signals, integrated seamlessly into JavaScript objects and arrays. This library does not depend on any specific reactive library and can be used by any UI framework to manage and react to changes in state effectively.

## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [API](#api)
  - [store(values, proto)](#storevalues-proto)
  - [is(value)](#isvalue)
  - [api.is](#apiis)
  - [api.signal](#apisignal)
  - [api.get](#apiget)
  - [api.set](#apiset)
- [Usage](#usage)
  - [Basic Usage](#basic-usage)
  - [Advanced Usage](#advanced-usage)
  - [Deeply Nested Structures](#deeply-nested-structures)
  - [Arrays and Objects](#arrays-and-objects)
  - [Reactivity and Effects](#reactivity-and-effects)
- [Integration with Solid.js, Preact Signals or any](#integration-with-solidjs-preact-signals-or-any)

## Installation

To use this library, you can install it using npm or yarn:

```bash
npm install ustor
yarn add ustor
```

This library can be integrated with `solid-js`, `@preact/signals-core`, `ulive`, `usignal`, `oby`, `sinuous` any other libarary you can think of for managing reactive signals.

## Setup

First, import the `store` function and the `api` object. You need to initialize `api` with your preferred signal implementation.

```javascript
import { store, api } from "./src";
import { createSignal } from "solid-js";
// import { signal } from '@preact/signals-core'; // 'usignal' 'ulive'

// Solid.js setup
api.signal = createSignal;
api.get = (v) => v[0]();
api.set = (signal, v) => signal[1](v);
api.is = (v) =>
	(Array.isArray(v) &&
		typeof v[0] === "function" &&
		typeof v[1] === "function") ||
	v[0]?.name?.includes("readSignal");

// @preact/signals-core, usignal or ulive setup
api.signal = signal;
api.get = (v) => v.value;
api.set = (signal, v) => (signal.value = v);
api.is = (v) => v?.peek;
```

## API

### `store(values, proto)`

The `store` function creates a stateful object that automatically converts properties into reactive signals.

- **values**: The initial values for the store, which can be objects, arrays, or primitives.
- **proto**: Optional prototype to set for the new store object.

The function returns a reactive store object that maintains the structure of the original `values` while adding reactivity.

### `is(value)`

The `is` function checks if a given value is a reactive store instance.

- **value**: The value to check.

Returns `true` if the value is a reactive store, otherwise `false`.

### `api.is`

The api.is function checks if a given value is a signal.

- **value**: The value to check.

Returns true if the value is a signal, otherwise false.

### `api.signal`

The `api.signal` function is used to create a reactive signal.

- **value**: The initial value for the signal.

Returns a signal that can be used to create reactive state within the store.

### `api.get`

The `api.get` function retrieves the current value of a signal.

- **signal**: The signal whose value you want to retrieve.

Returns the current value of the signal.

### `api.set`

The `api.set` function updates the value of a signal.

- **signal**: The signal whose value you want to update.
- **value**: The new value to set.

Updates the signal with the provided value.

## Usage

### Basic Usage

```javascript
const s = store({ a: 1, b: 2 });
console.log(s.a); // 1
s.a = 5;
console.log(s.a); // 5
```

You can use the `store` function to create a reactive state object. Assigning a new value to `s.a` will automatically trigger updates wherever `s.a` is used.

### Advanced Usage

```javascript
const s = store({
	a: 2,
	b: 3,
	get sum() {
		return this.a + this.b;
	},
});

console.log(s.sum); // 5
s.a = 5;
console.log(s.sum); // 8
```

Here, you can define getters that automatically compute derived state values, and these getters will update whenever the underlying signals change.

### Deeply Nested Structures

The `store` function can also handle deeply nested objects, converting nested properties into reactive signals:

```javascript
const s = store({ nested: { deep: { value: 10 } } });
const deepValue = s.nested.deep.value * 2;

console.log(deepValue); // 20
s.nested.deep.value = 15;
console.log(s.nested.deep.value) * 2; // 30
```

### Arrays and Objects

This library can handle arrays and objects seamlessly, automatically wrapping array elements with reactivity:

```javascript
const s = store({ list: [1, 2, 3] });
const sum = s.list.reduce((acc, item) => acc + item, 0);

console.log(sum); // 6
s.list = [1, 5, 3];
console.log(s.list.reduce((acc, item) => acc + item, 0)); // 9
```

### Reactivity and Effects

The signal value trigger with effects to track dependencies and automatically re-run whenever dependencies change:

```javascript
const s = store({ a: 1 });
let effectValue = 0;

effect(() => {
	effectValue = s.a * 2;
});

console.log(effectValue); // 2
s.a = 4;
console.log(effectValue); // 8
```

## Integration with Solid.js, Preact Signals or any

This library can be used with Solid.js, Preact Signals, or any other UI framework to provide reactive signals.

To use Solid.js:

```javascript
import { createSignal } from "solid-js";

api.signal = createSignal;
api.get = (v) => v?.[0]();
api.set = (signal, v) => signal?.[1](v);
api.is = (v) =>
	(Array.isArray(v) &&
		typeof v[0] === "function" &&
		typeof v[1] === "function") ||
	v?.[0]?.name?.includes("readSignal");
```

To use Preact Signals, usignal, ulive, etc:

```javascript
import { signal } from "@preact/signals-core";

api.signal = signal;
api.get = (v) => v?.value;
api.set = (signal, v) => (signal.value = v);
api.is = (v) => v?.peek;
```

To use any signal library

```javascript
import ... from "...";

api.signal = ...;
api.get = ...;
api.set = (signal, value) => ...;
api.is = (v) => ...;

const state = store({
	count: 0
});
```

The library provides a unified API to work with different reactive systems, allowing you to switch between Solid.js, Preact Signals, or any other UI framework easily.

### License

This library is provided "as-is" under the MIT license. Feel free to use, modify, and distribute it in your projects.

### Thanks and Inspiration

- **[dy](https://github.com/dy)**
