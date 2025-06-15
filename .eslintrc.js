module.exports = {
  extends: ['plugin:require-path-exists/recommended', 'plugin:requirejs/recommended', 'standard', 'prettier'],
  plugins: ['require-path-exists', 'requirejs'],
  rules: {
    camelcase: 'off',
  },
};
