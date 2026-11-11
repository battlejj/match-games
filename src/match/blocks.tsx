// Pattern-block shapes, drawn in their standard colors. Each one means
// something in the app (see the color notes in styles.css).

export type BlockShape =
  | 'hexagon'
  | 'rhombus'
  | 'triangle'
  | 'square'
  | 'trapezoid'

const r3 = Math.sqrt(3)

const SHAPES: Record<
  BlockShape,
  { viewBox: string; points: string; fill: string }
> = {
  hexagon: {
    viewBox: `0 0 ${2 * r3} 4`,
    points: `${r3},0 ${2 * r3},1 ${2 * r3},3 ${r3},4 0,3 0,1`,
    fill: 'var(--color-hex)',
  },
  rhombus: {
    viewBox: `0 0 ${r3 + 2} ${r3 + 0.0001}`,
    points: `1,0 ${r3 + 2},0 ${r3 + 1},${r3} 0,${r3}`,
    fill: 'var(--color-rhombus)',
  },
  triangle: {
    viewBox: `0 0 2 ${r3}`,
    points: `1,0 2,${r3} 0,${r3}`,
    fill: 'var(--color-triangle)',
  },
  trapezoid: {
    viewBox: `0 0 2 ${r3 / 2}`,
    points: `0.5,0 1.5,0 2,${r3 / 2} 0,${r3 / 2}`,
    fill: 'var(--color-trapezoid)',
  },
  square: {
    viewBox: '0 0 2 2',
    points: '0,0 2,0 2,2 0,2',
    fill: 'var(--color-square)',
  },
}

export function Block({
  shape,
  className = '',
}: {
  shape: BlockShape
  className?: string
}) {
  const { viewBox, points, fill } = SHAPES[shape]
  return (
    <svg
      viewBox={viewBox}
      aria-hidden="true"
      className={`shrink-0 overflow-visible ${className}`}
    >
      <polygon
        points={points}
        fill={fill}
        stroke="var(--color-ink)"
        strokeOpacity={0.55}
        strokeWidth={0.12}
        strokeLinejoin="round"
      />
    </svg>
  )
}
