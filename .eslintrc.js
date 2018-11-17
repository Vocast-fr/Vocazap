module.exports = {
  extends: [
    'plugin:require-path-exists/recommended',
    'plugin:requirejs/recommended',
    'standard'
  ],
  plugins: ['require-path-exists', 'requirejs'],
  rules: {
    camelcase: 'off'
  }
}
