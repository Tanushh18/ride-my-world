/**
 * Separate from vite.config.js on purpose: that one sets `root: 'sources/'` for
 * the app build, which would make Vitest look for tests inside the sources tree.
 */
export default {
    test:
    {
        include: [ 'tests/**/*.test.js' ],
        environment: 'node'
    }
}
