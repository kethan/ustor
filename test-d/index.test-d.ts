import { api, is, store } from "ustor";
import type { SignalApi, Store } from "ustor";

function expectType<Value>(_value: Value): void {}

const state = store({
	count: 1,
	nested: { text: "hello" },
	list: [1, 2],
	get double() { return this.count * 2; },
});

expectType<number>(state.count);
expectType<number>(state.double);
expectType<string>(state.nested.text);
expectType<number>(state.list[0]);
expectType<number>(state.list.push(3));
state.count = 2;
state.nested.text = "world";
state.list[0] = 4;

// @ts-expect-error count is a number
state.count = "not a number";
// @ts-expect-error nested text is a string
state.nested.text = 42;
// @ts-expect-error unknown properties are not in the inferred store type
state.missing;

const tuple = store([1, "two"] as const);
expectType<1>(tuple[0]);
expectType<"two">(tuple[1]);
expectType<null>(store(null));
expectType<string>(store("value"));
expectType<Store<{ value: number }>>(store({ value: 1 }));

const symbolKey = Symbol("value");
const withSymbol = store({ [symbolKey]: 1 });
expectType<number>(withSymbol[symbolKey]);

const customPrototype = { double: (value: number) => value * 2 };
store({ value: 2 }, customPrototype);
store({ value: 2 }, null);

const unknownValue: unknown = {};
if (is(unknownValue)) expectType<object>(unknownValue);
expectType<boolean>(is(null));

const customApi: SignalApi<{ value: unknown }> = {
	signal: (value) => ({ value }),
	get: (signal) => signal.value,
	set: (signal, value) => { signal.value = value; },
	is: (value) => typeof value === "object" && value !== null && "value" in value,
};
expectType<SignalApi>(api);
expectType<SignalApi<{ value: unknown }>>(customApi);
