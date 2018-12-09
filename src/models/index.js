const radios = require('./radios')
const streamRecords = require('./streamRecords')
const zaps = require('./zaps')

module.exports = {
  ...radios,
  ...streamRecords,
  ...zaps
}
