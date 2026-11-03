"use strict";

// eslint-plugin-import, eslint-plugin-react and eslint-plugin-jsx-a11y still
// depend on minimatch 3, which has no release patched for
// GHSA-g3hv-75wg-m249. pnpm-workspace.yaml points `minimatch@<4` here. Those
// plugins call the module itself (or its `default`) as a function and read
// `Minimatch`, `filter` and friends from it, which minimatch 11's CommonJS
// build no longer offers, so this gives 11.0.1 the old shape. Remove it once
// the plugins move off minimatch 3.
const modern = require("minimatch");

function minimatch(path, pattern, options) {
  return modern.minimatch(path, pattern, options);
}

Object.assign(minimatch, modern.minimatch, modern);
minimatch.minimatch = minimatch;
minimatch.default = minimatch;

module.exports = minimatch;
