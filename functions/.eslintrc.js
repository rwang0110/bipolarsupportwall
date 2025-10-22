module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2020, // or 2021, 2022
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "quotes": ["error", "double"],
    "max-len": ["error", { "code": 120 }],
    "object-curly-spacing": ["error", "always"],
    "require-jsdoc": 0,
  },
};
