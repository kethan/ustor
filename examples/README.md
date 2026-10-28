# UStor examples

Small, focused examples for the reactive core, adapters, React, SSR, browsers, and TypeScript. The Node examples use assertions as well as console output, so they double as executable documentation.

## Run everything

From the repository root:

```sh
npm ci
npm run examples
```

`npm run examples` builds the package, runs every Node example in a separate process, and type-checks the TypeScript/JSX examples. A separate process matters because `api` is shared: each example can configure a different adapter without contaminating the next one.

Run one Node example after building:

```sh
npm run build
node examples/node/01-counter.mjs
# or: node scripts/run-examples.mjs 01-counter.mjs
```

## Node examples

| File | Demonstrates |
| --- | --- |
| `node/01-counter.mjs` | Preact Signals setup, computed getters, effects, batching, and `$` signal access. |
| `node/02-shopping-cart.mjs` | Reactive arrays, nested item mutation, derived subtotal/total, and `splice`. |
| `node/03-form-validation.mjs` | Derived validation messages and batched form updates. |
| `node/04-async-users.mjs` | Injectable async loading, error states, and stale-response protection. |
| `node/05-undo-history.mjs` | Immutable snapshots, undo/redo, and clearing redo history after a new edit. |
| `node/06-vue-reactivity.mjs` | Vue `shallowRef`/`computed` adapter without double-wrapping UStor proxies. |
| `node/07-rxjs-basic.mjs` | RxJS `BehaviorSubject` as a basic adapter, including explicit subscription cleanup. |

The Vue and RxJS files intentionally run in their own processes. Do not switch `api` adapters while stores from another adapter are still in use.

## React

- `react/Counter.jsx` uses a primitive `useSelector` selector for a shared client-only counter.
- `react/TodoList.jsx` creates component-owned state and subscribes with primitive selectors for item count, remaining count, and draft text.

These are component source examples, not a bundled React application. Copy them into a React app, install `react` and `@preact/signals-core`, and import the shared setup before rendering. `TodoList` deliberately does **not** use `useSelector(() => state.todos)`: that returns the same mutable proxy, so an in-place mutation does not provide a changed React snapshot. Primitive selectors (or genuinely changed references) are the correct subscription boundary.

## Next.js App Router

- `nextjs/Counter.jsx` is a `"use client"` component with state owned by `useState`.
- `nextjs/page.jsx` is a Server Component that passes serializable initial props.

Copy the component into an app and make the adapter setup available to the client bundle. Use the same initial props for the server render and hydration; do not put request-specific state in a module-level singleton. These files document the integration pattern; this repository does not include a full Next.js application or claim to run a Next.js production build.

## Browser

`browser/index.html` and `browser/app.js` use native ES modules and an import map—no bundler or framework. Build first, then serve the **repository root** (the import map references `dist/` and `node_modules/`):

```sh
npm run build
python3 -m http.server 8080 --bind 0.0.0.0
```

Open `http://localhost:8080/examples/browser/` while the server is running. A static server is required; opening the HTML with `file://` will not resolve the module imports.

## TypeScript

`typescript/dashboard.ts` shows typed statuses, nested users, and derived getter types. It is checked by `tsconfig.examples.json`; the `unknown` status assignment in the comment is an intentional compile-error illustration, not an ignored error.

For the library's declaration and package checks, continue to use `npm test` and `npm run typecheck`.
