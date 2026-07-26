// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Workspace packages ship raw TypeScript, so Metro watches the whole repo and
// resolves from both node_modules trees (pnpm keeps dependencies isolated).
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// pnpm keeps each dependency's own node_modules, so hierarchical lookup stays
// on and symlinks are followed to the store.
config.resolver.unstable_enableSymlinks = true;

module.exports = withNativeWind(config, { input: "./global.css" });
