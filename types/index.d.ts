export interface SignalApi<Signal = any, Memo = any> {
	signal(value: any): Signal;
	get(signal: Signal): any;
	set(signal: Signal, value: any): void;
	is(value: unknown): boolean;
	memo?(fn: () => any): Memo;
	getMemo?(memo: Memo): any;
	effect?(fn: () => void): () => void;
	[key: string]: unknown;
}

export type SignalAliases<T> = T extends readonly unknown[] ? unknown : {
	readonly [K in keyof T as K extends string
		? K extends `$${string}` ? never : `$${K}`
		: never]?: any;
};

export type Store<T> = T extends (...args: any[]) => any
	? T
	: T extends readonly unknown[]
		? { [K in keyof T]: Store<T[K]> }
		: T extends object
			? { [K in keyof T]: Store<T[K]> } & SignalAliases<T>
			: T;

export declare const api: SignalApi;

export declare function is(value: unknown): value is object;

export declare function store<T>(values: T, proto?: object | null): Store<T>;
