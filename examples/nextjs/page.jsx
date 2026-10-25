import Counter from "./Counter.jsx";

// This Server Component passes serializable initial data to the Client
// Component. The same props must be used for the initial hydration render.
export default function Page() {
	return (
		<main>
			<h1>UStor + Next.js</h1>
			<Counter initialCount={1} initialItems={[1, 2]} />
		</main>
	);
}
