import { runQuery, formatMovieFromNeo4j, isNeo4jConfigured } from "@/lib/neo4j"
import neo4j from "neo4j-driver"

export async function GET(request, { params }) {
  try {
    if (!isNeo4jConfigured()) {
      return Response.json({ error: "Database not configured" }, { status: 503 })
    }
    const { id } = await params
    const movieId = Number.parseInt(id)
    if (isNaN(movieId)) {
      return Response.json({ error: "Invalid movie ID" }, { status: 400 })
    }

    const query = `
      MATCH (m:Movie {id: $movieId})
      OPTIONAL MATCH (m)-[:IN_GENRE]->(g:Genre)
      WITH m, collect(g.name) as genres
      RETURN m.id as id, m.title as title, m.releaseYear as releaseYear,
             m.imageUrl as imageUrl, m.synopsis as synopsis, genres as genre,
             m.voteAverage as voteAverage
    `

    const records = await runQuery(query, { movieId: neo4j.int(movieId) })

    if (records.length === 0) {
      return Response.json({ error: "Movie not found" }, { status: 404 })
    }

    const movie = formatMovieFromNeo4j(records[0])
    return Response.json({ movie })
  } catch (error) {
    console.error(`Error fetching movie:`, error)
    return Response.json({ error: "Failed to load movie" }, { status: 500 })
  }
}
