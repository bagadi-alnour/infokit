/**
 * NativeWind's Babel preset compiles `className` on React Native components;
 * `react-native-worklets` powers Reanimated 4 and must stay last.
 */
module.exports = function babel(api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-worklets/plugin"],
  };
};
