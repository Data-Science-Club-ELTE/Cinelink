"use client"

import { useState, useEffect } from "react"
import { MovieGrid } from "@/components/movie-grid"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { User, Star, Film, Trash2 } from "lucide-react"

export default function ProfilePage() {
  const [userRatings, setUserRatings] = useState([])
  const [ratedMovies, setRatedMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Load user ratings and rated movies on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Fetch user ratings
        const ratingsResponse = await fetch("/api/ratings")
        if (!ratingsResponse.ok) throw new Error("Failed to fetch ratings")
        const ratingsData = await ratingsResponse.json()
        setUserRatings(ratingsData.ratings || [])

        // Fetch rated movies with details
        const ratedMoviesResponse = await fetch("/api/ratings/movies")
        if (!ratedMoviesResponse.ok) throw new Error("Failed to fetch rated movies")
        const ratedMoviesData = await ratedMoviesResponse.json()
        setRatedMovies(ratedMoviesData.movies || [])
      } catch (error) {
        console.error("Error loading user data:", error)
        toast({
          title: "Error",
          description: "Failed to load your profile data. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [])

  // Handle movie rating change
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

      // Update the rated movies list
      const updatedRatedMovies = [...ratedMovies]
      const movieIndex = updatedRatedMovies.findIndex((m) => m.id === movieId)
      if (movieIndex >= 0) {
        updatedRatedMovies[movieIndex].rating = rating
        setRatedMovies(updatedRatedMovies)
      }

      toast({
        title: "Rating Updated",
        description: "Your rating has been updated.",
      })
    } catch (error) {
      console.error("Error saving rating:", error)
      toast({
        title: "Error",
        description: "Failed to update rating. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Clear all ratings
  const clearAllRatings = async () => {
    if (confirm("Are you sure you want to clear all your ratings? This cannot be undone.")) {
      try {
        // Call API to clear ratings
        const response = await fetch("/api/ratings", {
          method: "DELETE",
        })

        if (!response.ok) throw new Error("Failed to clear ratings")

        setUserRatings([])
        setRatedMovies([])

        toast({
          title: "Ratings Cleared",
          description: "All your ratings have been cleared.",
        })
      } catch (error) {
        console.error("Error clearing ratings:", error)
        toast({
          title: "Error",
          description: "Failed to clear ratings. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  // Group movies by rating
  const moviesByRating = {}
  for (let i = 5; i >= 1; i--) {
    moviesByRating[i] = ratedMovies.filter((movie) => movie.rating === i)
  }

  // Calculate genre preferences
  const genrePreferences = {}
  ratedMovies.forEach((movie) => {
    if (movie.genre) {
      movie.genre.forEach((genre) => {
        if (!genrePreferences[genre]) {
          genrePreferences[genre] = { count: 0, totalRating: 0 }
        }
        genrePreferences[genre].count += 1
        genrePreferences[genre].totalRating += movie.rating
      })
    }
  })

  // Sort genres by average rating
  const sortedGenres = Object.entries(genrePreferences)
    .map(([genre, data]) => ({
      genre,
      count: data.count,
      avgRating: data.totalRating / data.count,
    }))
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 5) // Top 5 genres

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-1/3">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <User className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Your Profile</h2>
                <p className="text-muted-foreground">Movie Recommendation System</p>

                <div className="mt-6 w-full">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Movies Rated</span>
                    <span>{userRatings.length}</span>
                  </div>

                  {sortedGenres.length > 0 && (
                    <div className="mt-4">
                      <h3 className="font-medium mb-2 text-left">Top Genres</h3>
                      {sortedGenres.map(({ genre, avgRating }) => (
                        <div key={genre} className="flex justify-between text-sm mb-1">
                          <span>{genre}</span>
                          <div className="flex items-center">
                            <span className="mr-1">{avgRating.toFixed(1)}</span>
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button variant="destructive" className="mt-6 w-full" onClick={clearAllRatings}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Ratings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:w-2/3">
          <h2 className="text-2xl font-bold mb-6">Your Rated Movies</h2>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : ratedMovies.length > 0 ? (
            <Tabs defaultValue="all">
              <TabsList className="mb-6">
                <TabsTrigger value="all">All Ratings</TabsTrigger>
                {[5, 4, 3, 2, 1].map(
                  (rating) =>
                    moviesByRating[rating]?.length > 0 && (
                      <TabsTrigger key={rating} value={rating.toString()}>
                        {rating} Star{rating !== 1 ? "s" : ""}
                      </TabsTrigger>
                    ),
                )}
              </TabsList>

              <TabsContent value="all">
                <MovieGrid movies={ratedMovies} userRatings={userRatings} onRatingChange={handleRatingChange} />
              </TabsContent>

              {[5, 4, 3, 2, 1].map(
                (rating) =>
                  moviesByRating[rating]?.length > 0 && (
                    <TabsContent key={rating} value={rating.toString()}>
                      <MovieGrid
                        movies={moviesByRating[rating]}
                        userRatings={userRatings}
                        onRatingChange={handleRatingChange}
                      />
                    </TabsContent>
                  ),
              )}
            </Tabs>
          ) : (
            <div className="text-center py-12 bg-card rounded-lg">
              <Film className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">You haven't rated any movies yet.</p>
              <p className="mt-2">Start rating movies to get personalized recommendations!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
