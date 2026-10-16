"use client"

import { useState } from "react"
import { Star } from "lucide-react"

export function StarRating({ rating, onRatingChange }) {
  const [hoverRating, setHoverRating] = useState(0)
  const [currentRating, setCurrentRating] = useState(rating || 0)

  const handleClick = (index) => {
    const newRating = index + 1
    setCurrentRating(newRating)
    if (onRatingChange) {
      onRatingChange(newRating)
    }
  }

  return (
    <div className="flex items-center">
      {[...Array(5)].map((_, index) => {
        const filled = index < (hoverRating || currentRating)

        return (
          <Star
            key={index}
            className={`w-5 h-5 cursor-pointer transition-colors duration-150 ${
              filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
            }`}
            onMouseEnter={() => setHoverRating(index + 1)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => handleClick(index)}
          />
        )
      })}
    </div>
  )
}
