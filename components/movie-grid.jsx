"use client"

import { useState } from "react"
import { MovieLensCard } from "./movie-lens-card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function MovieGrid({ movies, userRatings, onRatingChange, pageSize = 12, bookmarkedIds = [], onBookmarkToggle }) {
  const [currentPage, setCurrentPage] = useState(1)

  const seenIds = new Set()
  const validMovies = movies.filter((movie) => {
    if (movie.id == null || seenIds.has(String(movie.id))) return false
    seenIds.add(String(movie.id))
    return true
  })
  const totalPages = Math.ceil(validMovies.length / pageSize)
  const page = Math.min(currentPage, Math.max(1, totalPages))
  const startIndex = (page - 1) * pageSize
  const visibleMovies = validMovies.slice(startIndex, startIndex + pageSize)

  const goToNextPage = () => {
    if (page < totalPages) {
      setCurrentPage(page + 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const goToPrevPage = () => {
    if (page > 1) {
      setCurrentPage(page - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
        {visibleMovies.map((movie) => (
          <MovieLensCard
            key={movie.id}
            movie={movie}
            userRating={userRatings?.find((r) => r.movieId === movie.id)?.rating}
            onRatingChange={(rating) => onRatingChange(movie.id, rating)}
            bookmarked={bookmarkedIds.includes(movie.id)}
            onBookmarkToggle={onBookmarkToggle}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-10 gap-2">
          <Button variant="outline" size="sm" className="rounded-lg" onClick={goToPrevPage} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <span className="mx-4 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" className="rounded-lg" onClick={goToNextPage} disabled={page === totalPages}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
