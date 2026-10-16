// Original fictional development fixtures. No TMDB credentials or image downloads.
const { openDriver } = require('./db-config.cjs')
const neo4j = require('neo4j-driver')
const movies = require('../tests/fixtures/movies.json')
async function seed(driver) {
  const session = driver.session()
  try {
    for (const movie of movies) {
      await session.run(`MERGE (m:Movie {id: $id})
        ON CREATE SET m.title=$title, m.releaseYear=$year, m.synopsis=$synopsis,
          m.imageUrl='/placeholder.svg', m.voteAverage=$score, m.voteCount=10,
          m.developmentSeed=true
        WITH m UNWIND $genres AS name
        MERGE (g:Genre {name:name}) MERGE (m)-[:IN_GENRE]->(g)`, {
        id: neo4j.int(movie.id), title: movie.title, year: neo4j.int(movie.year),
        synopsis: movie.synopsis, score: movie.score, genres: movie.genres,
      })
    }
  } finally { await session.close() }
}
if (require.main === module) {
  const driver = openDriver()
  seed(driver).then(() => console.log(`Seeded ${movies.length} fictional development movies (repeatable).`))
    .catch(error => { console.error('Seed failed:', error.code || error.name); process.exitCode = 1 })
    .finally(() => driver.close())
}
module.exports = { seed }
