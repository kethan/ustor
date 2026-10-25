import terser from '@rollup/plugin-terser';
import bundleSize from 'rollup-plugin-bundle-size';

const resolve = (pkg, input = "src/index", output = "dist/index") => ({
	input: `${input}.js`,
	plugins: [
		bundleSize()
	],
	output: [
		{
			file: `${output}.es.js`,
			format: 'es',
		},
		{
			file: `${output}.cjs`,
			format: 'cjs',
		},
		{
			file: `${output}.min.js`,
			format: 'iife',
			name: pkg,
			strict: false,
			compact: true,
			plugins: [terser()]
		},
		{
			file: `${output}.umd.js`,
			format: 'umd',
			name: pkg,
			strict: false,
			compact: true,
			plugins: [terser()]
		}
	]
});

export default [
	resolve("ustor"),
	{
		input: "src/react.js",
		external: ["react"],
		output: [
			{
				file: "dist/react.es.js",
				format: "es",
				plugins: [terser()],
			},
			{
				file: "dist/react.cjs",
				format: "cjs",
				plugins: [terser()],
			},
		],
	},
];