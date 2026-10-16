// Simple content-based recommendation engine
export function getRecommendations(movies, userRatings, count = 20) {
  // If no user ratings, return all movies
  if (!userRatings || userRatings.length === 0) {
    return movies.slice(0, count)
  }

  // Get user's genre preferences
  const genrePreferences = getUserGenrePreferences(movies, userRatings)

  // Get IDs of movies the user has already rated
  const ratedMovieIds = new Set(userRatings.map((r) => r.movieId))

  // Calculate a score for each movie based on genre match
  const scoredMovies = movies
    .filter((movie) => !ratedMovieIds.has(movie.id)) // Filter out already rated movies
    .map((movie) => {
      let score = 0

      // Add score based on genre match
      if (movie.genre && movie.genre.length > 0) {
        movie.genre.forEach((genre) => {
          if (genrePreferences[genre]) {
            score += genrePreferences[genre]
          }
        })
        // Normalize by number of genres
        score = score / movie.genre.length
      }

      return { ...movie, score }
    })

  // Sort by score and return top recommendations
  return scoredMovies.sort((a, b) => b.score - a.score).slice(0, count)
}

// Get user's genre preferences based on ratings
function getUserGenrePreferences(movies, userRatings) {
  const genrePreferences = {}

  // Get movies that user has rated
  const ratedMovies = userRatings
    .map((rating) => {
      const movie = movies.find((m) => m.id === rating.movieId)
      return movie ? { ...movie, userRating: rating.rating } : null
    })
    .filter(Boolean)

  // Count genre occurrences weighted by rating
  ratedMovies.forEach((movie) => {
    if (movie.genre && movie.genre.length > 0) {
      movie.genre.forEach((genre) => {
        if (!genrePreferences[genre]) {
          genrePreferences[genre] = { count: 0, totalRating: 0 }
        }
        genrePreferences[genre].count += 1
        genrePreferences[genre].totalRating += movie.userRating
      })
    }
  })

  // Calculate average rating per genre
  const genreScores = {}
  Object.entries(genrePreferences).forEach(([genre, data]) => {
    genreScores[genre] = data.totalRating / data.count
  })

  return genreScores
}
