import { runQuery, formatMovieFromNeo4j, isNeo4jConfigured } from "@/lib/neo4j"
import neo4j from "neo4j-driver"

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE = "https://api.themoviedb.org/3"
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

async function fetchTmdbMovies({ search, genre, page = 1, limit = 20 }) {
  try {
    // Fetch genre list once to map IDs → names
    const genreRes = await fetch(`${TMDB_BASE}/genre/movie/list?api_key=${TMDB_API_KEY}`)
    const genreData = await genreRes.json()
    const genreMap = {}
    for (const g of genreData.genres || []) genreMap[g.id] = g.name

    let results = []
    let total = 0

    if (search) {
      const res = await fetch(
        `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(search)}&page=${page}`
      )
      const data = await res.json()
      results = data.results || []
      total = data.total_results || results.length
    } else if (genre) {
      // Find genre ID by name
      const genreId = Object.entries(genreMap).find(([, name]) => name === genre)?.[0]
      if (genreId) {
        const res = await fetch(
          `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`
        )
        const data = await res.json()
        results = data.results || []
        total = data.total_results || results.length
      }
    } else {
      const res = await fetch(
        `${TMDB_BASE}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`
      )
      const data = await res.json()
      results = data.results || []
      total = data.total_results || results.length
    }

    const movies = results.slice(0, limit).map((m) => ({
      id: m.id,
      title: m.title || m.original_title || "Unknown",
      releaseYear: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null,
      imageUrl: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : "/placeholder.svg?height=400&width=300",
      synopsis: m.overview || "No synopsis available.",
      genre: (m.genre_ids || []).map((id) => genreMap[id]).filter(Boolean),
      voteAverage: m.vote_average ?? null,
    }))

    return {
      movies,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  } catch (err) {
    console.error("TMDB fallback error:", err.name)
    return { movies: [], pagination: { total: 0, page, limit, totalPages: 0 } }
  }
}

const emptyMoviesResponse = (page = 1, limit = 20) =>
  Response.json({
    movies: [],
    pagination: {
      total: 0,
      page,
      limit,
      totalPages: 0,
    },
  })

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return Response.json({ error: "Use page >= 1 and limit between 1 and 100" }, { status: 400 })
    }
    const genre = searchParams.get("genre")
    const search = searchParams.get("search")

    if (!isNeo4jConfigured()) {
      if (!TMDB_API_KEY) return emptyMoviesResponse(page, limit)
      const result = await fetchTmdbMovies({ search, genre, page, limit })
      return Response.json(result)
    }

    let query = `
      MATCH (m:Movie)
    `

    const params = {
      skip: neo4j.int((page - 1) * limit),
      limit: neo4j.int(limit)
    }

    // Add genre filter if provided
    if (genre) {
      query += `
        MATCH (m)-[:IN_GENRE]->(g:Genre {name: $genre})
      `
      params.genre = genre
    }

    // Sample graphs may contain Movie nodes without the IDs required by the app.
    query += `\n WHERE m.id IS NOT NULL\n`

    // Add search filter if provided
    if (search) {
      query += `
        AND toLower(m.title) CONTAINS toLower($search)
      `
      params.search = search
    }

    // Get total count for pagination
    const countQuery =
      query +
      `
      RETURN count(m) as total
    `
    const countResult = await runQuery(countQuery, params)
    const total = countResult[0]?.total || 0

    // Get movies with pagination
    query += `
      WITH m
      OPTIONAL MATCH (m)-[:IN_GENRE]->(g:Genre)
      WITH m, collect(g.name) as genres
      RETURN m.id as id, m.title as title, m.releaseYear as releaseYear,
             m.imageUrl as imageUrl, m.synopsis as synopsis, genres as genre,
             m.voteAverage as voteAverage
      ORDER BY m.title
      SKIP $skip LIMIT $limit
    `

    const records = await runQuery(query, params)
    const movies = records.map(formatMovieFromNeo4j)

    return Response.json({
      movies,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching movies:", error)
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    return emptyMoviesResponse(page, limit)
  }
}
