import { useLayoutEffect, useRef, useState } from 'react'

interface BoardLayout {
  cols: number
  cardWidth: number
  gap: number
}

// Measures the space available for the board and picks the column count that
// yields the largest 3:4 cards with no scrolling — so the same deck lays out
// as 4×6 on a portrait phone and 6×4 on a landscape tablet.
export function useBoardLayout(count: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<BoardLayout>({
    cols: 4,
    cardWidth: 0,
    gap: 8,
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const compute = () => {
      const { width, height } = el.getBoundingClientRect()
      const gap = Math.min(width, height) >= 600 ? 12 : 8
      let best: BoardLayout = { cols: 4, cardWidth: 0, gap }
      for (let cols = 2; cols <= count; cols++) {
        if (count % cols !== 0) continue
        const rows = count / cols
        const byWidth = (width - (cols - 1) * gap) / cols
        const byHeight = ((height - (rows - 1) * gap) / rows) * (3 / 4)
        const cardWidth = Math.floor(Math.min(byWidth, byHeight))
        if (cardWidth > best.cardWidth) best = { cols, cardWidth, gap }
      }
      setLayout(best)
    }
    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(el)
    return () => observer.disconnect()
  }, [count])

  return [ref, layout] as const
}
