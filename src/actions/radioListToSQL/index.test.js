/* eslint-env mocha */

const { assert, expect } = require('chai')
const main = require('./main.js')

describe('radioListToSQL', function () {
  // A string explanation of what we're testing
  it('should execute without problems', async function () {
    const { updated, inserted, e } = await main()
    assert.equal(121, updated)
    assert.equal(0, inserted)
    expect(e).to.be.equal(undefined)
  })
})
