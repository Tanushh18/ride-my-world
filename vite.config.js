import wasm from 'vite-plugin-wasm'

export default {
    root: 'sources/',
    publicDir: '../static/',
    base: './',
    server:
    {
        host: true,
        port: 5173
    },
    build:
    {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: false,
        // Rapier's WASM glue relies on top-level await. Targeting esnext lets
        // the browser handle it natively instead of transpiling it, which is
        // what vite-plugin-top-level-await did before it broke against newer swc.
        target: 'esnext'
    },
    optimizeDeps:
    {
        esbuildOptions:
        {
            target: 'esnext'
        }
    },
    plugins:
    [
        wasm()
    ]
}
