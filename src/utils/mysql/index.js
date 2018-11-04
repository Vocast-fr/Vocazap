require('dotenv').config()

const { MYSQL_DB, MYSQL_HOST, MYSQL_PWD, MYSQL_USER } = process.env

const knex = require('knex')({
  client: 'mysql',
  connection: {
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PWD,
    database: MYSQL_DB
  }
})

function upsertData (table, refKeys, data) {
  let q = knex(table).update(data)
  for (const refKey of refKeys) {
    q = q.where(refKey, '=', data[refKey])
  }
  return q.then(updated => {
    if (!updated) {
      return knex
        .insert(data)
        .table(table)
        .then(inserted => ({ inserted }))
    } else {
      return {
        updated
      }
    }
  })
}

function upsertDatas (table, refKeys, datas) {
  return Promise.all(datas.map(data => upsertData(table, refKeys, data))).then(
    results => {
      let updated = 0
      let inserted = 0
      results.forEach(r => {
        if (r.updated) updated += r.updated
        if (r.inserted) inserted += r.inserted
      })
      return { inserted, updated }
    }
  )
}

module.exports = {
  getKnexConnection: () => knex,
  upsertData,
  upsertDatas
}
