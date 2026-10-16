import { runQuery, isNeo4jConfigured } from "@/lib/neo4j"

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE = "https://api.themoviedb.org/3"

export async function GET() {
  try {
    if (!isNeo4jConfigured()) {
      if (!TMDB_API_KEY) return Response.json({ genres: [] })
      try {
        const res = await fetch(`${TMDB_BASE}/genre/movie/list?api_key=${TMDB_API_KEY}`)
        const data = await res.json()
        const genres = (data.genres || []).map((g) => ({ name: g.name, movieCount: null }))
        return Response.json({ genres })
      } catch {
        return Response.json({ genres: [] })
      }
    }
    const query = `
      MATCH (g:Genre)
      OPTIONAL MATCH (g)<-[:IN_GENRE]-(m:Movie)
      WITH g, count(m) as movieCount
      RETURN g.name as name, movieCount
      ORDER BY name
    `

    const records = await runQuery(query)
    const genres = records.map((record) => ({
      name: record.name,
      movieCount: record.movieCount,
    }))

    return Response.json({ genres })
  } catch (error) {
    console.error("Error fetching genres:", error)
    return Response.json({ genres: [] })
  }
}
