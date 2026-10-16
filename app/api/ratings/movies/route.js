import { runQuery, formatMovieFromNeo4j, isNeo4jConfigured } from "@/lib/neo4j"
import { requireAuth } from "@/lib/auth-utils"

export async function GET() {
  try {
    const user = await requireAuth()
    if (!isNeo4jConfigured()) return Response.json({ movies: [] })

    const userId = user.id

    const query = `
      MATCH (u:User {id: $userId})-[r:RATED]->(m:Movie)
      OPTIONAL MATCH (m)-[:IN_GENRE]->(g:Genre)
      WITH m, r, collect(g.name) as genres
      RETURN m.id as id, m.title as title, m.releaseYear as releaseYear,
             m.imageUrl as imageUrl, m.synopsis as synopsis, genres as genre,
             m.voteAverage as voteAverage, r.rating as rating
      ORDER BY r.timestamp DESC
    `

    const records = await runQuery(query, { userId })
    const movies = records.map(formatMovieFromNeo4j)

    return Response.json({ movies })
  } catch (error) {
    if (error?.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error fetching rated movies:", error)
    return Response.json({ movies: [] })
  }
}
