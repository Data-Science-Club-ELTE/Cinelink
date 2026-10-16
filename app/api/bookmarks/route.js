import { runQuery, formatMovieFromNeo4j, isNeo4jConfigured } from "@/lib/neo4j"
import neo4j from "neo4j-driver"
import { requireAuth } from "@/lib/auth-utils"

export async function GET() {
  let user
  try {
    user = await requireAuth()
  } catch {
    return Response.json({ error: "Unauthorized", bookmarks: [], bookmarkedIds: [] }, { status: 401 })
  }
  try {
    if (!isNeo4jConfigured()) {
      return Response.json({ bookmarks: [], bookmarkedIds: [] })
    }
    const userId = user.id

    const query = `
      MATCH (u:User {id: $userId})-[:BOOKMARKED]->(m:Movie)
      OPTIONAL MATCH (m)-[:IN_GENRE]->(g:Genre)
      WITH m, collect(g.name) as genres
      RETURN m.id as id, m.title as title, m.releaseYear as releaseYear,
             m.imageUrl as imageUrl, m.synopsis as synopsis, genres as genre,
             m.voteAverage as voteAverage
      ORDER BY m.title
    `
    const records = await runQuery(query, { userId })
    const bookmarks = records.map(formatMovieFromNeo4j)
    const bookmarkedIds = bookmarks.map((m) => m.id)
    return Response.json({ bookmarks, bookmarkedIds })
  } catch (error) {
    console.error("Error fetching bookmarks:", error)
    return Response.json({ bookmarks: [], bookmarkedIds: [] })
  }
}

export async function POST(request) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    if (!isNeo4jConfigured()) {
      return Response.json({ error: "Database not available" }, { status: 503 })
    }
    const userId = user.id
    const body = await request.json().catch(() => ({}))
    const movieId = Number(body.movieId)
    if (!Number.isSafeInteger(movieId) || movieId === 0) {
      return Response.json({ error: "Invalid movie ID" }, { status: 400 })
    }

    const query = `
      MATCH (u:User {id: $userId})
      MATCH (m:Movie {id: $movieId})
      MERGE (u)-[:BOOKMARKED]->(m)
      RETURN m.id as id
    `
    const result = await runQuery(query, { userId, movieId: neo4j.int(movieId) })
    if (!result.length) return Response.json({ error: "Movie not found" }, { status: 404 })
    return Response.json({ success: true, bookmarked: true })
  } catch (error) {
    console.error("Error adding bookmark:", error)
    return Response.json({ error: "Failed to add bookmark" }, { status: 500 })
  }
}

export async function DELETE(request) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    if (!isNeo4jConfigured()) {
      return Response.json({ success: true })
    }
    const userId = user.id
    const body = await request.json().catch(() => ({}))
    const movieId = Number(body.movieId)
    if (!Number.isSafeInteger(movieId) || movieId === 0) {
      return Response.json({ error: "Invalid movie ID" }, { status: 400 })
    }

    const query = `
      MATCH (u:User {id: $userId})-[r:BOOKMARKED]->(m:Movie {id: $movieId})
      DELETE r
      RETURN count(r) as deleted
    `
    await runQuery(query, { userId, movieId: neo4j.int(movieId) })
    return Response.json({ success: true, bookmarked: false })
  } catch (error) {
    console.error("Error removing bookmark:", error)
    return Response.json({ error: "Failed to remove bookmark" }, { status: 500 })
  }
}
