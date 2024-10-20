let api = {},
    _s = Symbol("s"),
    is = (v) => v[_s],
    isObject = (v) => v && v.constructor === Object,
    resolve = (v) => Array.isArray(v) ? store(v) : isObject(v) ? Object.seal(store(v)) : v,
    store = (values, proto) => {
        if ((is(values) && !proto) || !(api.signal && api.get && api.set && api.is)) return values;
        if (Array.isArray(values)) values.forEach((item, i) => values[i] = is(item) ? item : store(item));
        if (isObject(values)) {
            let state = Object.create(proto || Object.getPrototypeOf(values));
            Object.entries(Object.getOwnPropertyDescriptors(values)).forEach(
                ([key, desc]) => {
                    let signal = api.is(desc.value) ? desc.value : api.signal(resolve(desc.value)),
                        memo = desc.get ? (api.memo ? api.memo(desc.get.bind(state)) : desc.get.bind(state)()) : signal;
                    Object.defineProperty(state, key, {
                        get: () => desc.get ? memo : api.get(memo),
                        set: desc.get ? desc.set?.bind(state) : v => api.set(signal, resolve(v)),
                        enumerable: true,
                    });
                }
            );
            Object.defineProperty(state, _s, { value: true });
            return state;
        }
        return values;
    }

export {
    is,
    store,
    api
}