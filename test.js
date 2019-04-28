const clean = require('./src/actions/clean')

clean().catch(e => console.error('Main error for clean', e))
