import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/manufacturing.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
});
