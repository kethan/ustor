import { store, api } from './src';
// import { signal, computed, effect, batch } from '@preact/signals-core';
import { createSignal, createEffect, createMemo, batch } from './node_modules/solid-js/dist/solid'
import { assert, describe, it } from 'vitest';


//Solid.js
api.memo = createMemo;
api.signal = createSignal;
api.effect = createEffect;
api.batch = batch;
api.getMemo = v => v?.();
api.is = v => v?.[0]?.name?.includes("readSignal");
api.get = v => v?.[0]();
api.set = (signal, v) => signal?.[1](v);

// @preact/signals-core, usignal, ulive
// api.memo = computed;
// api.signal = signal;
// api.effect = effect;
// api.batch = batch;
// api.getMemo = v => v?.value;
// api.is = (v) => v?.peek;
// api.get = (v) => v?.value;
// api.set = (signal, v) => (signal.value = v);

describe('Store functionality', () => {
  let i = api.signal(3);
  let s;
  let len;
  let xy;
  let s1;
  it('should initialize store with signals and functions', () => {
    let i = api.signal(3);
    s = store({
      x: 0,
      y: api.signal(1),
      z: { r: 2, i },
      v: function () {
        return 1;
      },
      w: [1, 2],
      get xy() {
        return this.x + this.y;
      },
      set xy([x, y]) {
        this.x = x;
        this.y = y;
      },
    });
  });

  it('should treat functions as signals', () => {
    assert.equal(s.v(), 1);
  });

  it('should subscribe to signals without explicit .value access', () => {
    const zilog = [];
    api.effect(() => zilog.push(s.z.i));
    xy = api.memo(() => s.x + s.y);
    assert.equal(api.getMemo(xy), 1);
    s.x = 2;
    s.y = 3;
    assert.equal(api.getMemo(xy), 5);
    s.y = 4;
    assert.equal(api.getMemo(xy), 6);
    assert.deepEqual(zilog, [3]);
  });

  it('should handle getter computed properties correctly', () => {
    assert.equal(api.getMemo(s.xy), 6);
    s.xy = [4, 2];
    assert.equal(s.x, 4);
    assert.equal(s.y, 2);
    assert.equal(api.getMemo(s.xy), 6);
  });

  it('should subscribe to deep values and update results', () => {
    len = api.memo(() => (s.z.r ** 2 + s.z.i ** 2) ** 0.5);
    s.z.r = 3;
    s.z.i = 4;
    assert.equal(api.getMemo(len), 5);
    s.z.r = 4;
    s.z.i = 3;
    assert.equal(api.getMemo(len), 5);
  });

  it('should update internal objects/arrays and turn them into signals', () => {
    s.z = { r: 5, i: 12 };
    assert.equal(api.getMemo(len), 13);
  });


  it('should handle updating arrays', () => {
    let mult = api.memo(() => s.w[0] * s.w[1]);
    assert.equal(api.getMemo(mult), 2);
    s.w = [3, 4];
    assert.equal(api.getMemo(mult), 12);
  });

  it('should handle bulk updates with batch', () => {
    api.batch(() => Object.assign(s, { x: 1, y: 1, z: { r: 3, i: 4 } }));
    assert.equal(api.getMemo(xy), 2);
    assert.equal(api.getMemo(len), 5, 'len after update');
  });

  it('should retain the same type as the initial data for signals', () => {
    assert.equal(s.constructor, Object);
  });

  it('should return the same instance when re-initializing store', () => {
    s1 = store(s);
    assert.equal(s, s1);
  });

  it('should ensure that store is not enumerable', () => {
    let s2 = store([]);
    let log = [];
    for (let i of s2) log.push(i);
    assert.deepEqual(log, [], "doesn't iterate");
  });

  it('should detect descendants as instances', () => {
    let s3 = Object.create(s1),
      s3s = store(s3);
    assert.equal(s3, s3s);
  });

  it('should convert array items to signal structs', () => {
    let s5 = store({ list: [{ x: 1 }, { x: 2 }] });
    let sum = api.memo(() => s5.list.reduce((sum, item) => item.x + sum, 0));
    assert.equal(api.getMemo(sum), 3);
    s5.list[0].x = 2;
    assert.equal(api.getMemo(sum), 4);
    s5.list = [{ x: 3 }, { x: 3 }];
    assert.equal(api.getMemo(sum), 6);
    s5.list = [{ x: 3 }, { x: 3 }, { x: 4 }];
    assert.equal(api.getMemo(sum), 10);
  });

  it('should retain reference for arrays', () => {
    let list = [1, 2, 3];
    let s6 = store({ list });
    s6.list[1] = 4;
    assert.deepEqual(list, [1, 4, 3])
  });
});

describe('Store Functionality - Basic to Complex', () => {
  // Simple Test Cases
  it('should initialize a store with simple values', () => {
    const s = store({ a: 1, b: 2 });
    assert.equal(s.a, 1);
    assert.equal(s.b, 2);
  });

  it('should update store values', () => {
    const s = store({ a: 1 });
    s.a = 5;
    assert.equal(s.a, 5);
  });

  it('should initialize store with signals', () => {
    const s = store({ a: api.signal(3) });
    assert.equal(s.a, 3);
  });

  it('should update signal value within store', () => {
    const s = store({ a: api.signal(3) });
    s.a = 10;
    assert.equal(s.a, 10);
  });

  it('should compute a derived value', () => {
    const s = store({ a: api.signal(2), b: api.signal(3) });
    const sum = api.memo(() => s.a + s.b);
    assert.equal(api.getMemo(sum), 5);
    s.a = 5;
    assert.equal(api.getMemo(sum), 8);
  });

  // Intermediate Test Cases
  it('should handle nested store updates', () => {
    const s = store({ nested: { a: api.signal(1) } });
    assert.equal(s.nested.a, 1);
    s.nested.a = 4;
    assert.equal(s.nested.a, 4);
  });

  it('should react to changes in nested signals', () => {
    const s = store({ nested: { a: api.signal(1) } });
    const double = api.memo(() => s.nested.a * 2);
    assert.equal(api.getMemo(double), 2);
    s.nested.a = 3;
    assert.equal(api.getMemo(double), 6);
  });

  it('should allow effect to react to signal changes', () => {
    const s = store({ a: api.signal(1) });
    let effectValue = 0;
    api.effect(() => {
      effectValue = s.a * 2;
    });
    assert.equal(effectValue, 2);
    s.a = 4;
    assert.equal(effectValue, 8);
  });

  it('should batch updates to prevent redundant computations', () => {
    const s = store({ a: api.signal(1), b: api.signal(2) });
    let computeCount = 0;
    const sum = api.memo(() => {
      computeCount++;
      return s.a + s.b;
    });
    assert.equal(api.getMemo(sum), 3);
    assert.equal(computeCount, 1);
    api.batch(() => {
      s.a = 3;
      s.b = 4;
    });
    assert.equal(api.getMemo(sum), 7);
    assert.equal(computeCount, 2);
  });

  // Complex Test Cases
  it('should handle arrays within the store', () => {
    const s = store({ list: [1, 2, 3] });
    const sum = api.memo(() => s.list.reduce((acc, item) => acc + item, 0));
    assert.equal(api.getMemo(sum), 6);
    s.list = [1, 5, 3]
    assert.equal(api.getMemo(sum), 9);
  });

  it('should handle nested computed properties', () => {
    const s = store({ a: api.signal(2), b: api.signal(3) });
    const product = api.memo(() => s.a * s.b);
    const doubleProduct = api.memo(() => api.getMemo(product) * 2);
    assert.equal(api.getMemo(doubleProduct), 12);
    s.a = 4;
    assert.equal(api.getMemo(doubleProduct), 24);
  });

  it('should allow dynamic property addition and maintain reactivity', () => {
    const s = store({ a: api.signal(1) });
    s.b = api.signal(2);
    const sum = api.memo(() => s.a + api.get(s.b));
    assert.equal(api.getMemo(sum), 3);
    api.set(s.b, 5)
    assert.equal(api.getMemo(sum), 6);
  });

  it('should react to changes in deeply nested structures', () => {
    const s = store({ nested: { deep: { value: api.signal(10) } } });
    const deepValue = api.memo(() => s.nested.deep.value * 2);
    assert.equal(api.getMemo(deepValue), 20);
    s.nested.deep.value = 15;
    assert.equal(api.getMemo(deepValue), 30);
  });

  // Combination of Arrays and Objects
  it('should handle arrays of objects within the store', () => {
    const s = store({ list: [{ x: api.signal(1) }, { x: api.signal(2) }, { x: api.signal(3) }] });
    const sum = api.memo(() => s.list.reduce((acc, item) => acc + item.x, 0));
    assert.equal(api.getMemo(sum), 6);
    s.list[1].x = 5;
    assert.equal(api.getMemo(sum), 9);
  });

  it('should handle objects with array properties and nested signals', () => {
    const s = store({ a: api.signal(1), b: [2, 3] });
    const sum = api.memo(() => s.a + s.b.reduce((acc, item) => acc + item, 0));
    assert.equal(api.getMemo(sum), 6);
    s.a = 2;
    s.b = [2, 4]
    assert.equal(api.getMemo(sum), 8);
  });

  it('should handle deeply nested arrays and objects', () => {
    const s = store({ nested: [{ x: { y: api.signal(2) } }, { x: { y: api.signal(3) } }] });
    const total = api.memo(() => s.nested.reduce((acc, item) => acc + item.x.y, 0));
    assert.equal(api.getMemo(total), 5);
    s.nested[0].x.y = 4;
    assert.equal(api.getMemo(total), 7);
  });

  it('should update array elements that are objects with signals', () => {
    const s = store({ list: [{ a: api.signal(1) }, { a: api.signal(2) }] });
    const sum = api.memo(() => s.list.reduce((acc, item) => acc + item.a, 0));
    assert.equal(api.getMemo(sum), 3);
    s.list = [...s.list, { a: api.signal(4) }]
    assert.equal(api.getMemo(sum), 7);
    s.list[0].a = 5;
    assert.equal(api.getMemo(sum), 11);
  });
});


describe('Extreme Testing - Simple Reactivity', () => {
  // Stress test rapid updates
  it('should handle rapid signal updates', () => {
    const s = store({ a: api.signal(0) });
    let updates = 0;
    api.effect(() => {
      updates = s.a;
    });
    for (let i = 0; i < 10000; i++) {
      s.a = i;
    }
    assert.equal(s.a, 9999);
    assert.equal(updates, 9999);
  });

  // Stress test deep nesting with correct access
  it('should handle deeply nested signals within the store', () => {
    let deep = { value: 1 };
    for (let i = 0; i < 50; i++) {
      deep = { nested: deep };
    }
    const s = store({ deep });
    // // Access the 50th level of nesting for example
    let nestedValue = s.deep;
    for (let i = 0; i < 50; i++) {
      nestedValue = nestedValue.nested;
    }
    assert.equal(nestedValue.value, 1);
    nestedValue.value = 50; // Update deeply nested signal

    assert.equal(s.deep.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.nested.value, 50); // Confirm update at the correct depth
  });

  // Test massive batch updates
  it('should handle massive batch updates without redundant computations', () => {
    const s = store({ a: api.signal(1), b: api.signal(1) });
    let computeCount = 0;
    const sum = api.memo(() => {
      computeCount++;
      return s.a + s.b;
    });
    assert.equal(api.getMemo(sum), 2);
    api.batch(() => {
      for (let i = 0; i < 10000; i++) {
        s.a = i;
        s.b = i + 1;
      }
    });
    assert.equal(api.getMemo(sum), 19999);
    assert.equal(computeCount, 2); // Only computed twice (initial and after batch)
  });

  // Test bulk effect cleanup
  it('should clean up effects properly during bulk updates', () => {
    const s = store({ a: api.signal(0) });
    let activeEffects = 0;
    const cleanupEffect = api.effect(() => {
      s.a = activeEffects++;
      // if(api.cleanup) api.cleanup(() => s.a = activeEffects--)
      // else
      // return () => s.a = activeEffects--;
    });

    for (let i = 0; i < 1000; i++) {
      s.a = i;
    }

    assert.equal(s.a, 999);
    // cleanupEffect();
    // assert.equal(s.a, 1);
  });
});
