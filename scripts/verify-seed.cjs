const assert = require('node:assert/strict')
const { openDriver } = require('./db-config.cjs')
const { seed } = require('./seed-neo4j.cjs')
async function main() {
  const driver = openDriver(), session = driver.session()
  async function snapshot() {
    const result = await session.run(`CALL { MATCH (u:User) RETURN count(u) AS users }
      CALL { MATCH ()-[r:RATED]->() RETURN count(r) AS ratings }
      CALL { MATCH (m:Movie) WHERE m.developmentSeed=true RETURN count(m) AS movies }
      CALL { MATCH (m:Movie)-[g:IN_GENRE]->() WHERE m.developmentSeed=true RETURN count(g) AS genres }
      RETURN users, ratings, movies, genres`)
    return Object.fromEntries(Object.entries(result.records[0].toObject()).map(([k,v])=>[k,v.toNumber()]))
  }
  try {
    const before=await snapshot()
    await seed(driver); const once=await snapshot()
    await seed(driver); const twice=await snapshot()
    assert.deepEqual(once,twice)
    assert.equal(twice.users,before.users);assert.equal(twice.ratings,before.ratings)
    assert.equal(twice.movies,6);assert.equal(twice.genres,12)
    console.log('PASS seed twice: six fixtures, twelve genre edges, unchanged user/rating counts')
  } finally { await session.close();await driver.close() }
}
main().catch(error=>{console.error('Seed repeatability failed:',error.code || error.message);process.exitCode=1})
