const api = {};
const _s = Symbol();
const cache = new WeakMap();
const mutators = /^(copyWithin|fill|pop|push|reverse|shift|sort|splice|unshift)$/;

const is = (v) => !!v?.[_s];
const isObject = (v) => {
	const proto = v && Object.getPrototypeOf(v);
	return v != null && (proto === null || proto?.constructor === Object);
};
const resolve = (v) => Array.isArray(v) || isObject(v) ? store(v) : v;

const arrayStore = (values) => {
	const version = api.signal(0);
	let depth = 0,
		changed = false;
	const track = () => api.get(version);
	const notify = () => {
		changed = false;
		api.set(version, api.get(version) + 1);
	};
	const proxy = new Proxy(values, {
		get: (target, key, receiver) => {
			if (key === _s) return true;
			track();
			const value = Reflect.get(target, key, receiver);
			if (typeof key === "string" && mutators.test(key) && typeof value === "function") {
				return (...args) => {
					depth++;
					try {
						return value.apply(receiver, args);
					} finally {
						if (!--depth && changed) notify();
					}
				};
			}
			return value;
		},
		set: (target, key, value) => {
			const next = resolve(value);
			if (Object.is(target[key], next)) return true;
			if (!Reflect.set(target, key, next)) return false;
			if (depth) changed = true;
			else notify();
			return true;
		},
		deleteProperty: (target, key) => {
			if (!Object.hasOwn(target, key)) return true;
			if (!Reflect.deleteProperty(target, key)) return false;
			if (depth) changed = true;
			else notify();
			return true;
		},
		ownKeys: (target) => {
			track();
			return Reflect.ownKeys(target);
		},
		has: (target, key) => {
			track();
			return Reflect.has(target, key);
		},
	});
	cache.set(values, proxy);
	values.forEach((item, i) => {
		values[i] = resolve(item);
	});
	return proxy;
};

const objectStore = (values, proto) => {
	const state = Object.create(proto === undefined ? Object.getPrototypeOf(values) : proto);
	cache.set(values, state);
	Reflect.ownKeys(values).forEach((key) => {
		const desc = Object.getOwnPropertyDescriptor(values, key),
			accessor = desc.get || desc.set,
			getter = desc.get?.bind(state),
			memoize = getter && api.memo,
			signal = accessor ? undefined : api.is(desc.value) ? desc.value : api.signal(resolve(desc.value));
		let memo;
		const getSignal = () => getter ? (memo ||= memoize(getter)) : signal;
		Object.defineProperty(state, key, {
			get: accessor
				? getter
					? () => memoize ? (api.getMemo || api.get)(getSignal()) : getter()
					: undefined
				: () => api.get(signal),
			set: accessor
				? desc.set?.bind(state)
				: desc.writable === false
					? undefined
					: (v) => api.set(signal, resolve(v)),
			enumerable: desc.enumerable,
		});
		if (
			(!accessor || memoize) &&
			typeof key === "string" &&
			!key.startsWith("$") &&
			!Object.hasOwn(values, "$" + key)
		) {
			Object.defineProperty(state, "$" + key, {
				get: getSignal,
				enumerable: false,
			});
		}
	});
	Object.defineProperty(state, _s, { value: true });
	return Object.seal(state);
};

const store = (values, proto) => {
	if (is(values)) return values;
	if (!Array.isArray(values) && !isObject(values)) return values;
	const cached = cache.get(values);
	if (cached) return cached;
	if (!(api.signal && api.get && api.set && api.is)) {
		throw new Error("ustor: configure api.signal, api.get, api.set and api.is");
	}
	return Array.isArray(values) ? arrayStore(values) : objectStore(values, proto);
};

export { is, store, api };
