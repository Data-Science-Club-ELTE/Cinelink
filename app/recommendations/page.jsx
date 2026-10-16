"use client"

import { useState, useEffect } from "react"
import { MovieGrid } from "@/components/movie-grid"
import { useToast } from "@/components/ui/use-toast"

const FETCH_TIMEOUT_MS = 10000

function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id))
}

export default function RecommendationsPage() {
  const [movies, setMovies] = useState([])
  const [userRatings, setUserRatings] = useState([])
  const [bookmarkedIds, setBookmarkedIds] = useState([])
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [loading, setLoading] = useState(true)
  const [genres, setGenres] = useState([])
  const { toast } = useToast()

  // Load user ratings and movies on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const ratingsResponse = await fetchWithTimeout("/api/ratings").catch(() => null)
        const ratingsData = ratingsResponse ? await ratingsResponse.json().catch(() => ({})) : {}
        if (ratingsResponse?.ok) {
          setUserRatings(ratingsData.ratings || [])
        } else {
          setUserRatings([])
        }

        const bookmarksResponse = await fetchWithTimeout("/api/bookmarks").catch(() => null)
        if (bookmarksResponse?.ok) {
          const bookmarksData = await bookmarksResponse.json().catch(() => ({}))
          setBookmarkedIds(bookmarksData.bookmarkedIds || [])
        }

        const genresResponse = await fetchWithTimeout("/api/genres").catch(() => null)
        const genresData = genresResponse ? await genresResponse.json().catch(() => ({})) : {}
        setGenres(genresData.genres || [])
        if (genresResponse && !genresResponse.ok) {
          toast({
            title: "Setup needed",
            description: "Add Neo4j and run setup-db + import-movies to see genres.",
            variant: "destructive",
          })
        }

        await fetchMovies()
      } catch (error) {
        console.error("Error loading initial data:", error)
        toast({
          title: "Loading timed out",
          description: "Data is taking too long. Check your connection or try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [])

  // Fetch movies with optional genre filter
  const fetchMovies = async (genre = null) => {
    setLoading(true)
    try {
      let url = "/api/movies?limit=100"
      if (genre) {
        url += `&genre=${encodeURIComponent(genre)}`
      }

      const response = await fetchWithTimeout(url)
      const data = await response.json().catch(() => ({}))
      setMovies(data.movies || [])

      if (!response.ok) {
        toast({
          title: "No movies yet",
          description: "Set up Neo4j and run import-movies to browse movies.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching movies:", error)
      setMovies([])
      toast({
        title: "Error",
        description: "Failed to load movies. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle genre selection
  const handleGenreSelect = (genre) => {
    setSelectedGenre(genre)
    fetchMovies(genre)
  }

  // Handle movie rating
  const handleRatingChange = async (movieId, rating) => {
    try {
      // Save rating to API
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ movieId, rating }),
      })

      if (!response.ok) throw new Error("Failed to save rating")

      // Update local state
      const newRatings = [...userRatings]
      const existingRatingIndex = newRatings.findIndex((r) => r.movieId === movieId)

      if (existingRatingIndex >= 0) {
        newRatings[existingRatingIndex].rating = rating
      } else {
        newRatings.push({ movieId, rating })
      }

      setUserRatings(newRatings)

      toast({
        title: "Rating Saved",
        description: "Your rating has been saved.",
      })
    } catch (error) {
      console.error("Error saving rating:", error)
      toast({
        title: "Error",
        description: "Failed to save rating. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBookmarkToggle = async (movieId) => {
    try {
      const isBookmarked = bookmarkedIds.includes(movieId)
      const method = isBookmarked ? "DELETE" : "POST"
      const response = await fetch("/api/bookmarks", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId }),
      })
      if (response.status === 401) {
        toast({
          title: "Sign in to bookmark",
          description: "Please sign in to save bookmarks.",
          variant: "destructive",
        })
        return
      }
      if (!response.ok) throw new Error("Failed to update bookmark")
      if (isBookmarked) {
        setBookmarkedIds((prev) => prev.filter((id) => id !== movieId))
      } else {
        setBookmarkedIds((prev) => [...prev, movieId])
      }
      toast({
        title: isBookmarked ? "Bookmark removed" : "Bookmarked",
        description: isBookmarked ? "Movie removed from bookmarks." : "Movie added to bookmarks.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update bookmark.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">All Movies</h1>
      <p className="text-muted-foreground mb-6">Browse by genre and rate to improve your recommendations.</p>

      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleGenreSelect(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedGenre === null
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </button>
          {genres.map((genre) => (
            <button
              key={genre.name}
              onClick={() => handleGenreSelect(genre.name)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedGenre === genre.name
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {genre.name} ({genre.movieCount})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-72">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <MovieGrid
          movies={movies}
          userRatings={userRatings}
          onRatingChange={handleRatingChange}
          bookmarkedIds={bookmarkedIds}
          onBookmarkToggle={handleBookmarkToggle}
        />
      )}
    </div>
  )
}
