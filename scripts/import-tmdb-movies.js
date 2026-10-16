/**
 * Import popular movies from TMDB into Neo4j.
 * Run from project root: node scripts/import-tmdb-movies.js
 * Requires .env.local: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, TMDB_API_KEY
 *
 * Get a free API key at https://www.themoviedb.org/settings/api
 */

const path = require('path')
const neo4j = require('neo4j-driver')

require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

const NEO4J_URI = process.env.NEO4J_URI
const NEO4J_USER = process.env.NEO4J_USER
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD
const TMDB_API_KEY = process.env.TMDB_API_KEY

if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
  console.error('Missing Neo4j config in .env.local (NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)')
  process.exit(1)
}
if (!TMDB_API_KEY) {
  console.error('Missing TMDB_API_KEY in .env.local. Get one at https://www.themoviedb.org/settings/api')
  process.exit(1)
}

const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'
const PAGES_TO_FETCH = Number(process.env.TMDB_IMPORT_PAGES || 1)
if (!Number.isInteger(PAGES_TO_FETCH) || PAGES_TO_FETCH < 1 || PAGES_TO_FETCH > 5) throw new Error('TMDB_IMPORT_PAGES must be 1 through 5')
const MOVIES_PER_PAGE = 20

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD), {
  connectionTimeout: 10000,
  maxConnectionPoolSize: 5,
})

async function fetchTMDB(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`TMDB request failed: HTTP ${res.status}`)
  return res.json()
}

async function getGenreMap() {
  const data = await fetchTMDB(`${TMDB_BASE}/genre/movie/list?api_key=${TMDB_API_KEY}`)
  const map = {}
  for (const g of data.genres || []) {
    map[g.id] = g.name
  }
  return map
}

async function getPopularMovies(page) {
  const data = await fetchTMDB(
    `${TMDB_BASE}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`
  )
  return data.results || []
}

async function main() {
  console.log('Fetching genre list from TMDB...')
  const genreMap = await getGenreMap()
  console.log(`Found ${Object.keys(genreMap).length} genres.\n`)

  const session = driver.session()
  try {
    // Ensure genres exist in Neo4j
    for (const [id, name] of Object.entries(genreMap)) {
      await session.run(
        'MERGE (g:Genre {name: $name}) ON CREATE SET g.tmdbId = $id',
        { name, id }
      )
    }
    console.log('Genres synced to Neo4j.')

    let total = 0
    for (let page = 1; page <= PAGES_TO_FETCH; page++) {
      console.log(`Fetching TMDB popular movies page ${page}/${PAGES_TO_FETCH}...`)
      const movies = await getPopularMovies(page)
      if (movies.length === 0) break

      for (const m of movies) {
        const id = m.id
        const title = m.title || m.original_title || 'Unknown'
        const releaseYear = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null
        const imageUrl = m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : null
        const synopsis = m.overview || 'No synopsis available.'
        const voteAverage = m.vote_average != null ? m.vote_average : null
        const voteCount = m.vote_count != null ? m.vote_count : 0
        const genreIds = m.genre_ids || []

        await session.run(
          `MERGE (m:Movie {id: $id})
           SET m.title = $title, m.releaseYear = $releaseYear, m.imageUrl = $imageUrl,
               m.synopsis = $synopsis, m.voteAverage = $voteAverage, m.voteCount = $voteCount`,
          {
            id: neo4j.int(id),
            title,
            releaseYear,
            imageUrl,
            synopsis,
            voteAverage,
            voteCount,
          }
        )

        for (const gid of genreIds) {
          const gname = genreMap[gid]
          if (gname) {
            await session.run(
              `MATCH (m:Movie {id: $movieId})
               MATCH (g:Genre {name: $genreName})
               MERGE (m)-[:IN_GENRE]->(g)`,
              { movieId: neo4j.int(id), genreName: gname }
            )
          }
        }
        total++
      }
    }

    console.log(`\nImported ${total} movies into Neo4j.`)
  } catch (error) {
    console.error('Import failed:', error.code || error.name)
    process.exitCode = 1
  } finally {
    await session.close()
    await driver.close()
  }
}

main().catch(async error => {
  console.error('Import failed:', error.code || error.name)
  process.exitCode = 1
  await driver.close()
})
