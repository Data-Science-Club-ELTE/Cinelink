// Mock movie data
export const movies = [
  {
    id: 1,
    title: "Inception",
    genre: ["Sci-Fi", "Action", "Thriller"],
    synopsis:
      "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    imageUrl: "/placeholder.svg",
    releaseYear: 2010,
  },
  {
    id: 2,
    title: "The Shawshank Redemption",
    genre: ["Drama"],
    synopsis:
      "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
    imageUrl: "/placeholder.svg",
    releaseYear: 1994,
  },
  {
    id: 3,
    title: "The Dark Knight",
    genre: ["Action", "Crime", "Drama"],
    synopsis:
      "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
    imageUrl: "/placeholder.svg",
    releaseYear: 2008,
  },
  {
    id: 4,
    title: "Pulp Fiction",
    genre: ["Crime", "Drama"],
    synopsis:
      "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.",
    imageUrl: "/placeholder.svg",
    releaseYear: 1994,
  },
  {
    id: 5,
    title: "The Godfather",
    genre: ["Crime", "Drama"],
    synopsis:
      "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
    imageUrl: "/placeholder.svg",
    releaseYear: 1972,
  },
  {
    id: 6,
    title: "Fight Club",
    genre: ["Drama"],
    synopsis:
      "An insomniac office worker and a devil-may-care soapmaker form an underground fight club that evolves into something much, much more.",
    imageUrl: "/placeholder.svg",
    releaseYear: 1999,
  },
  {
    id: 7,
    title: "Forrest Gump",
    genre: ["Drama", "Romance"],
    synopsis:
      "The presidencies of Kennedy and Johnson, the events of Vietnam, Watergate, and other historical events unfold through the perspective of an Alabama man with an IQ of 75.",
    imageUrl: "/placeholder.svg",
    releaseYear: 1994,
  },
  {
    id: 8,
    title: "The Matrix",
    genre: ["Action", "Sci-Fi"],
    synopsis:
      "A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.",
    imageUrl: "/placeholder.svg",
    releaseYear: 1999,
  },
  {
    id: 9,
    title: "Goodfellas",
    genre: ["Biography", "Crime", "Drama"],
    synopsis:
      "The story of Henry Hill and his life in the mob, covering his relationship with his wife Karen Hill and his mob partners Jimmy Conway and Tommy DeVito.",
    imageUrl: "/placeholder.svg",
    releaseYear: 1990,
  },
  {
    id: 10,
    title: "The Silence of the Lambs",
    genre: ["Crime", "Drama", "Thriller"],
    synopsis:
      "A young F.B.I. cadet must receive the help of an incarcerated and manipulative cannibal killer to help catch another serial killer.",
    imageUrl: "/placeholder.svg",
    releaseYear: 1991,
  },
]

// Mock user data
export const currentUser = {
  id: 1,
  name: "John Doe",
  email: "john.doe@example.com",
  avatar: "/placeholder.svg?height=100&width=100",
  ratedMovies: [
    { movieId: 1, rating: 5 },
    { movieId: 3, rating: 4 },
    { movieId: 5, rating: 5 },
  ],
}

// Get all movies
export function getAllMovies() {
  return movies
}

// Get movie by ID
export function getMovieById(id) {
  return movies.find((movie) => movie.id === Number(id))
}

// Get user's rated movies
export function getUserRatedMovies() {
  return currentUser.ratedMovies.map((ratedMovie) => {
    const movie = getMovieById(ratedMovie.movieId)
    return {
      ...movie,
      rating: ratedMovie.rating,
    }
  })
}

// Simple recommendation algorithm based on genre preferences
export function getRecommendedMovies() {
  // Get user's rated movies
  const ratedMovies = getUserRatedMovies()

  // Extract genres from rated movies
  const preferredGenres = new Set()
  ratedMovies.forEach((movie) => {
    movie.genre.forEach((genre) => preferredGenres.add(genre))
  })

  // Find movies with matching genres that user hasn't rated yet
  const ratedMovieIds = new Set(currentUser.ratedMovies.map((rm) => rm.movieId))
  const recommendations = movies
    .filter((movie) => !ratedMovieIds.has(movie.id))
    .filter((movie) => movie.genre.some((genre) => preferredGenres.has(genre)))
    .slice(0, 6)

  return recommendations
}

// Search movies by title
export function searchMovies(query) {
  if (!query) return []
  const lowerCaseQuery = query.toLowerCase()
  return movies.filter((movie) => movie.title.toLowerCase().includes(lowerCaseQuery))
}

// Rate a movie
export function rateMovie(movieId, rating) {
  const existingRatingIndex = currentUser.ratedMovies.findIndex((rm) => rm.movieId === movieId)

  if (existingRatingIndex >= 0) {
    currentUser.ratedMovies[existingRatingIndex].rating = rating
  } else {
    currentUser.ratedMovies.push({ movieId, rating })
  }
}

// Clear all ratings
export function clearRatings() {
  currentUser.ratedMovies = []
}
