"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StarRating } from "@/components/star-rating"
import { Button } from "@/components/ui/button"
import { Film, Bookmark, BookmarkCheck } from "lucide-react"

export function MovieLensCard({ movie, userRating, onRatingChange, bookmarked = false, onBookmarkToggle }) {
  const [imageError, setImageError] = useState(false)
  const [currentRating, setCurrentRating] = useState(userRating || 0)

  // Parse the MovieLens title format
  const titleMatch = movie.title ? movie.title.match(/(.*)\s*$$(\d{4})$$/) : null
  const title = titleMatch ? titleMatch[1].trim() : movie.title
  const year = movie.releaseYear || (titleMatch ? titleMatch[2] : null)

  const handleRatingChange = (rating) => {
    setCurrentRating(rating)
    if (onRatingChange) {
      onRatingChange(rating)  // Let parent handle adding movie.id
    }
  }

  return (
    <Card className="overflow-hidden h-full flex flex-col rounded-2xl border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="relative aspect-[2/3] overflow-hidden rounded-t-2xl">
        {movie.imageUrl && !imageError ? (
          <Image
            src={movie.imageUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            unoptimized={movie.imageUrl.startsWith("https://image.tmdb.org")}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Film className="w-14 h-14 text-muted-foreground/50" />
            <span className="sr-only">{title}</span>
          </div>
        )}
        {onBookmarkToggle && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-2.5 right-2.5 h-9 w-9 rounded-full shadow-lg bg-background/90 backdrop-blur-sm border-0 hover:bg-background"
            onClick={(e) => {
              e.preventDefault()
              onBookmarkToggle(movie.id)
            }}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark movie"}
          >
            {bookmarked ? (
              <BookmarkCheck className="h-4 w-4 text-primary" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      <CardHeader className="p-4 pb-0">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-base line-clamp-1 tracking-tight">{title}</h3>
            {year && <p className="text-sm text-muted-foreground mt-0.5">{year}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex-grow">
        {movie.genre && movie.genre.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {movie.genre.map((genre) => (
              <Badge key={genre} variant="secondary" className="text-xs font-normal rounded-md">
                {genre}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="h-6" />
        )}
        {movie.synopsis ? (
          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{movie.synopsis}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No synopsis available</p>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <StarRating rating={currentRating} onRatingChange={handleRatingChange} />
      </CardFooter>
    </Card>
  )
}
