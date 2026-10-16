"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { MovieGrid } from "@/components/movie-grid"
import { SearchBar } from "@/components/search"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { movies as fallbackMovies } from "@/lib/data"

const FETCH_TIMEOUT_MS = 10000

function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id))
}

export default function Home() {
  const [recommendations, setRecommendations] = useState(fallbackMovies)
  const [userRatings, setUserRatings] = useState([])
  const [bookmarkedIds, setBookmarkedIds] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Load user ratings and recommendations on component mount
  useEffect(() => {
    let cancelled = false
    const maxWait = 5000 // stop showing spinner after 5s no matter what

    const loadInitialData = async () => {
      try {
        let ratings = []

        const ratingsResponse = await fetchWithTimeout("/api/ratings").catch(() => null)
        if (cancelled) return
        if (ratingsResponse?.ok) {
          const ratingsData = await ratingsResponse.json()
          ratings = ratingsData.ratings || []
          setUserRatings(ratings)
        } else {
          setUserRatings([])
        }

        const bookmarksResponse = await fetchWithTimeout("/api/bookmarks").catch(() => null)
        if (!cancelled && bookmarksResponse?.ok) {
          const bookmarksData = await bookmarksResponse.json()
          setBookmarkedIds(bookmarksData.bookmarkedIds || [])
        }

        await fetchRecommendations(ratings)
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading initial data:", error)
          setRecommendations(fallbackMovies)
          toast({
            title: "Loading timed out",
            description: "Data is taking too long. Check your connection or try again.",
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadInitialData()
    const fallback = setTimeout(() => {
      setLoading(false)
    }, maxWait)
    return () => {
      cancelled = true
      clearTimeout(fallback)
    }
  }, [])

  // Fetch recommendations based on user ratings; if empty, fall back to /api/movies
  const fetchRecommendations = async (ratings, showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const response = await fetchWithTimeout("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userRatings: ratings }),
      })

      const data = await response.json().catch(() => ({}))
      const list = data.recommendations || []
      setRecommendations(list)

      if (list.length === 0) {
        const moviesRes = await fetchWithTimeout("/api/movies?limit=20").catch(() => null)
        if (moviesRes?.ok) {
          const moviesData = await moviesRes.json().catch(() => ({}))
          const movies = moviesData.movies || []
          if (movies.length > 0) setRecommendations(movies)
          else setRecommendations(fallbackMovies)
        } else {
          setRecommendations(fallbackMovies)
        }
      }

      if (!response.ok && list.length === 0) {
        toast({
          title: "Using popular movies",
          description: "Sign in and rate movies for personalized recommendations.",
          variant: "default",
        })
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error)
      setRecommendations(fallbackMovies)
      try {
        const moviesRes = await fetchWithTimeout("/api/movies?limit=20").catch(() => null)
        if (moviesRes?.ok) {
          const moviesData = await moviesRes.json().catch(() => ({}))
          const movies = moviesData.movies || []
          if (movies.length > 0) setRecommendations(movies)
        }
      } catch (_) { /* Use the existing database or empty state when optional data is absent. */ }
      toast({
        title: "Error",
        description: "Failed to load recommendations. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle movie rating (saves only; use "Refresh recommendations" to update list)
  const handleRatingChange = async (movieId, rating) => {
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ movieId, rating }),
      })

      if (response.status === 401) {
        toast({
          title: "Login required",
          description: "Please sign in to rate movies",
          variant: "destructive",
        })
        return
      }

      if (!response.ok) throw new Error("Failed to save rating")

      setUserRatings((previous) => {
        const remaining = previous.filter((entry) => entry.movieId !== movieId)
        return rating === 0 ? remaining : [...remaining, { movieId, rating }]
      })

      toast({
        title: "Rating Saved",
        description: "Click Refresh recommendations when you’re ready for new picks.",
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

  const handleRefreshRecommendations = async () => {
    setLoading(true)
    try {
      // Re-fetch ratings from server so the first (or latest) rating is always included
      const ratingsRes = await fetchWithTimeout("/api/ratings").catch(() => null)
      let ratingsToUse = userRatings
      if (ratingsRes?.ok) {
        const data = await ratingsRes.json().catch(() => ({}))
        ratingsToUse = data.ratings || []
        setUserRatings(ratingsToUse)
      }
      await fetchRecommendations(ratingsToUse, false)
      toast({
        title: "Recommendations updated",
        description: ratingsToUse.length > 0
          ? "Based on your ratings."
          : "Rate some movies and refresh for personalized picks.",
      })
    } catch (_) {
      toast({
        title: "Update failed",
        description: "Could not refresh recommendations.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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
        toast({ title: "Bookmark removed", description: "Movie removed from your bookmarks." })
      } else {
        setBookmarkedIds((prev) => [...prev, movieId])
        toast({ title: "Bookmarked", description: "Click Refresh recommendations to use this bookmark for new picks." })
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error)
      toast({
        title: "Error",
        description: "Failed to update bookmark. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle search
  const handleSearch = async (query) => {
    if (query.trim() === "") {
      setIsSearching(false)
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/movies?search=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error("Failed to search movies")

      const data = await response.json()
      setSearchResults(data.movies || [])
    } catch (error) {
      console.error("Error searching movies:", error)
      setSearchResults([])
      toast({
        title: "Search Error",
        description: "Failed to search movies. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <header className="mb-10 text-center sm:text-left">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Discover your next favorite
        </h1>
        <p className="mt-2 text-muted-foreground text-lg max-w-xl">
          Rate movies, get personalized picks, and save ones you love.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 max-w-xl">
            <SearchBar onSearch={handleSearch} />
          </div>
          <Link href="/bookmarks">
            <Button variant="outline" size="sm" className="rounded-lg shrink-0">
              Bookmarks
            </Button>
          </Link>
        </div>
      </header>

      {isSearching ? (
        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground border-b border-border/60 pb-2">
            Search Results
          </h2>
          {searchResults.length > 0 ? (
            <MovieGrid
              movies={searchResults}
              userRatings={userRatings}
              onRatingChange={handleRatingChange}
              bookmarkedIds={bookmarkedIds}
              onBookmarkToggle={handleBookmarkToggle}
            />
          ) : (
            <p className="text-center py-12 text-muted-foreground">No movies found matching your search.</p>
          )}
        </section>
      ) : (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-foreground">Featured for you</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefreshRecommendations}
              disabled={loading}
              className="rounded-lg"
            >
              {loading ? "Updating…" : "Refresh recommendations"}
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-72">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
            </div>
          ) : recommendations.length > 0 ? (
            <MovieGrid
              movies={recommendations}
              userRatings={userRatings}
              onRatingChange={handleRatingChange}
              bookmarkedIds={bookmarkedIds}
              onBookmarkToggle={handleBookmarkToggle}
            />
          ) : (
            <div className="text-center py-16 px-4 rounded-2xl bg-muted/50 border border-border/60">
              <p className="text-muted-foreground text-lg">
                Sign in to get personalized recommendations, or browse all movies.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mt-6">
                <Button asChild className="rounded-lg">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button variant="outline" asChild className="rounded-lg">
                  <Link href="/register">Create account</Link>
                </Button>
                <Button variant="secondary" asChild className="rounded-lg">
                  <Link href="/recommendations">Browse all movies</Link>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Setup: npm run setup-db then npm run import-movies
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
