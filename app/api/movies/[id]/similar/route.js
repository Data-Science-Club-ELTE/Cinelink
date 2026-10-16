import { runQuery, formatMovieFromNeo4j, isNeo4jConfigured } from "@/lib/neo4j"
import neo4j from "neo4j-driver"

export async function GET(request, { params }) {
  try {
    if (!isNeo4jConfigured()) {
      return Response.json({ movies: [] })
    }
    const { id } = await params
    const movieId = Number.parseInt(id)
    if (isNaN(movieId)) {
      return Response.json({ error: "Invalid movie ID" }, { status: 400 })
    }
    const { searchParams } = new URL(request.url)
    const count = Number.parseInt(searchParams.get("count") || "6")

    const query = `
      // Find the target movie
      MATCH (m:Movie {id: $movieId})

      // Find its genres
      MATCH (m)-[:IN_GENRE]->(g:Genre)

      // Find similar movies by genre
      MATCH (similar:Movie)-[:IN_GENRE]->(g)
      WHERE similar.id <> $movieId

      // Calculate similarity score
      WITH similar, count(g) as genreOverlap

      // Get movie details
      OPTIONAL MATCH (similar)-[:IN_GENRE]->(genre:Genre)
      WITH similar, genreOverlap, collect(genre.name) as genres

      // Return similar movies
      RETURN similar.id as id, similar.title as title,
             similar.releaseYear as releaseYear,
             similar.imageUrl as imageUrl, similar.synopsis as synopsis,
             genres as genre, similar.voteAverage as voteAverage
      ORDER BY genreOverlap DESC, similar.voteAverage DESC
      LIMIT $count
    `

    const records = await runQuery(query, {
      movieId: neo4j.int(movieId),
      count: neo4j.int(count)
    })
    const movies = records.map(formatMovieFromNeo4j)

    return Response.json({ movies })
  } catch (error) {
    console.error(`Error finding similar movies:`, error)
    return Response.json({ movies: [] })
  }
}
