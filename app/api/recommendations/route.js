import { runQuery, formatMovieFromNeo4j, isNeo4jConfigured } from "@/lib/neo4j"
import neo4j from "neo4j-driver"
import { getCurrentUser } from "@/lib/auth-utils"

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE = "https://api.themoviedb.org/3"
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
const RECOMMENDATION_LIMIT = 40

async function fetchTmdbPopular(limit = RECOMMENDATION_LIMIT) {
  try {
    const genreRes = await fetch(`${TMDB_BASE}/genre/movie/list?api_key=${TMDB_API_KEY}`)
    const genreData = await genreRes.json()
    const genreMap = {}
    for (const g of genreData.genres || []) genreMap[g.id] = g.name

    const res = await fetch(`${TMDB_BASE}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`)
    const data = await res.json()
    return (data.results || []).slice(0, limit).map((m) => ({
      id: m.id,
      title: m.title || m.original_title || "Unknown",
      releaseYear: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null,
      imageUrl: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : "/placeholder.svg?height=400&width=300",
      synopsis: m.overview || "No synopsis available.",
      genre: (m.genre_ids || []).map((id) => genreMap[id]).filter(Boolean),
      voteAverage: m.vote_average ?? null,
    }))
  } catch {
    return []
  }
}

const popularMoviesQuery = `
  MATCH (m:Movie)
  WHERE m.voteAverage IS NOT NULL
  OPTIONAL MATCH (m)-[:IN_GENRE]->(g:Genre)
  WITH m, collect(g.name) as genres
  RETURN m.id as id, m.title as title, m.releaseYear as releaseYear,
         m.imageUrl as imageUrl, m.synopsis as synopsis, genres as genre,
         m.voteAverage as voteAverage
  ORDER BY m.voteAverage DESC, coalesce(m.voteCount, 0) DESC
  LIMIT $limit
`

export async function POST(request) {
  try {
    if (!isNeo4jConfigured()) {
      const recommendations = TMDB_API_KEY ? await fetchTmdbPopular() : []
      return Response.json({ recommendations })
    }

    const user = await getCurrentUser()

    // seedIds  = movies the user liked (rating >= 3) OR bookmarked — drives genre matching
    // excludeIds = all movies the user has seen — never re-recommend these
    let seedMovieIds = []
    let excludeMovieIds = []

    if (user?.id) {
      const userId = user.id
      const [seedRows, seenRows] = await Promise.all([
        runQuery(
          `MATCH (u:User {id: $userId})-[r:RATED]->(m:Movie) WHERE r.rating >= 3 RETURN m.id AS id
           UNION
           MATCH (u:User {id: $userId})-[:BOOKMARKED]->(m:Movie) RETURN m.id AS id`,
          { userId }
        ),
        runQuery(
          `MATCH (u:User {id: $userId})-[:RATED|BOOKMARKED]->(m:Movie) RETURN m.id AS id`,
          { userId }
        ),
      ])
      for (const row of seedRows) if (row.id != null) seedMovieIds.push(Number(row.id))
      for (const row of seenRows) if (row.id != null) excludeMovieIds.push(Number(row.id))
    }

    // Fallback: use request body ratings as seeds if DB has nothing
    if (seedMovieIds.length === 0) {
      try {
        const body = await request.json().catch(() => ({}))
        const userRatings = Array.isArray(body.userRatings) ? body.userRatings : []
        for (const r of userRatings) {
          const id = Number(r.movieId)
          if (!Number.isNaN(id) && (r.rating == null || r.rating >= 3)) seedMovieIds.push(id)
          if (!Number.isNaN(id)) excludeMovieIds.push(id)
        }
      } catch (_) { /* Use the existing database or empty state when optional data is absent. */ }
    }

    const uniqueSeedIds = [...new Set(seedMovieIds)].filter((id) => !Number.isNaN(id))
    const uniqueExcludeIds = [...new Set(excludeMovieIds)].filter((id) => !Number.isNaN(id))

    if (uniqueSeedIds.length === 0) {
      const records = await runQuery(popularMoviesQuery, { limit: neo4j.int(RECOMMENDATION_LIMIT) })
      return Response.json({ recommendations: records.map(formatMovieFromNeo4j) })
    }

    const seedIds = uniqueSeedIds.map((id) => neo4j.int(id))
    const excludeIds = uniqueExcludeIds.map((id) => neo4j.int(id))

    // Use only liked movies (rating >= 3) to discover preferred genres,
    // but exclude all seen movies from results
    const query = `
      UNWIND $seedIds AS mid
      MATCH (m:Movie) WHERE m.id = mid
      MATCH (m)-[:IN_GENRE]->(g:Genre)
      WITH DISTINCT g
      MATCH (rec:Movie)-[:IN_GENRE]->(g)
      WHERE NOT rec.id IN $excludeIds
      WITH rec, count(DISTINCT g) AS genreMatches
      OPTIONAL MATCH (rec)-[:IN_GENRE]->(genre:Genre)
      WITH rec, genreMatches, collect(genre.name) AS genres
      RETURN rec.id AS id, rec.title AS title, rec.releaseYear AS releaseYear,
             rec.imageUrl AS imageUrl, rec.synopsis AS synopsis, genres AS genre,
             rec.voteAverage AS voteAverage, genreMatches AS score
      ORDER BY score DESC, rec.voteAverage DESC
      LIMIT $limit
    `

    let records = await runQuery(query, {
      seedIds,
      excludeIds,
      limit: neo4j.int(RECOMMENDATION_LIMIT),
    })
    let recommendations = records.map(formatMovieFromNeo4j)

    if (recommendations.length === 0) {
      const fallbackQuery = `
        UNWIND $excludeIds AS mid
        WITH collect(mid) AS excludeList
        MATCH (m:Movie)
        WHERE m.voteAverage IS NOT NULL AND NOT m.id IN excludeList
        OPTIONAL MATCH (m)-[:IN_GENRE]->(g:Genre)
        WITH m, collect(g.name) AS genres
        RETURN m.id AS id, m.title AS title, m.releaseYear AS releaseYear,
               m.imageUrl AS imageUrl, m.synopsis AS synopsis, genres AS genre,
               m.voteAverage AS voteAverage
        ORDER BY m.voteAverage DESC, coalesce(m.voteCount, 0) DESC
        LIMIT $limit
      `
      records = await runQuery(fallbackQuery, {
        excludeIds,
        limit: neo4j.int(RECOMMENDATION_LIMIT),
      })
      recommendations = records.map(formatMovieFromNeo4j)
    }
    if (recommendations.length === 0) {
      const fallback = await runQuery(popularMoviesQuery, { limit: neo4j.int(RECOMMENDATION_LIMIT) })
      recommendations = fallback.map(formatMovieFromNeo4j)
    }

    return Response.json({ recommendations })
  } catch (error) {
    console.error("Error generating recommendations:", error)
    return Response.json({ recommendations: [] })
  }
}
