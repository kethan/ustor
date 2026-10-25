import assert from "node:assert/strict";
import { store } from "../preact-setup.mjs";

const cart = store({
	items: [],
	taxRate: 0.1,
	get subtotal() {
		return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
	},
	get total() {
		return this.subtotal * (1 + this.taxRate);
	},
});

cart.items.push(
	{ id: "book", price: 12, quantity: 1 },
	{ id: "pen", price: 2, quantity: 3 },
);
assert.equal(cart.subtotal, 18);

cart.items[0].quantity = 2;
assert.equal(cart.subtotal, 30);
assert.ok(Math.abs(cart.total - 33) < Number.EPSILON);

const [removed] = cart.items.splice(1, 1);
assert.equal(removed.id, "pen");
assert.equal(cart.subtotal, 24);

console.log("Shopping cart example passed:", {
	items: cart.items.length,
	subtotal: cart.subtotal,
	total: cart.total.toFixed(2),
});
