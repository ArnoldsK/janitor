import path from "node:path"

import {
  CanvasRenderingContext2D,
  createCanvas,
  GlobalFonts,
} from "@napi-rs/canvas"
import * as d3 from "d3-hierarchy"
import * as d3Chromatic from "d3-scale-chromatic"

GlobalFonts.registerFromPath(
  path.join(__dirname, "fonts", "roboto.regular.ttf", "Roboto"),
)

interface D3NodeData {
  name: string
  value?: number
  children: {
    name: string
    value: number
  }[]
}

export const getMessageDistributionTreemapBuffer = ({
  rawData,
  width = 1200,
  height = 800,
}: {
  rawData: Array<{ channel: string; count: number }>
  width?: number
  height?: number
  otherThreshold?: number
}): Buffer => {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext("2d")

  // --- 1. Data Preprocessing and Structuring ---
  const totalCount = rawData.reduce((sum, d) => sum + d.count, 0)

  const rootData: D3NodeData = {
    name: "Root",
    children: rawData.map((d) => ({ name: d.channel, value: d.count })),
  }

  // --- 2. D3 Layout Calculation ---
  const root = d3
    .hierarchy<D3NodeData>(rootData)
    .sum((d) => d.value ?? 0)
    // eslint-disable-next-line unicorn/no-array-sort
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const treemap = d3
    .treemap<D3NodeData>()
    .size([width, height])
    .padding(1)
    .round(true)

  const nodes = treemap(root).leaves()

  // --- 3. Drawing on Canvas ---
  ctx.fillStyle = "#1e1e1e"
  ctx.fillRect(0, 0, width, height)

  const colorScale = (index: number) => d3Chromatic.schemeCategory10[index % 10]

  for (const [i, d] of nodes.entries()) {
    const x = d.x0
    const y = d.y0
    const w = d.x1 - d.x0
    const h = d.y1 - d.y0

    // Check for calculated dimensions from D3
    if (w <= 0 || h <= 0) continue

    // Skip drawing if the tile is too small (visual check)
    if (w < 5 || h < 5) continue

    // Draw the main rectangle
    ctx.fillStyle = colorScale(i)
    ctx.fillRect(x, y, w, h)

    // Draw a dark border
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, y, w, h)

    // Draw Text Label
    ctx.fillStyle = "white"
    ctx.textBaseline = "top"

    const name = parseName(d.data.name)
    const value = d.value ?? 0

    ctx.font = getOptimalFont(ctx, name, w - 8, 20)
    ctx.fillText(name, x + 4, y + 4)

    // Add percentage for larger tiles
    if (w > 100 && h > 40) {
      const percentage = ((value / totalCount) * 100).toFixed(1)
      const percentageText = `${percentage}%`

      ctx.font = getOptimalFont(ctx, percentageText, w - 8, 16)
      ctx.fillText(percentageText, x + 4, y + 28)
    }
  }

  // --- 4. Final Output ---
  return canvas.toBuffer("image/png")
}

const parseName = (name: string): string => {
  switch (name) {
    case "#💬": {
      return "#irl"
    }
    case "#👪": {
      return "#family"
    }
    default: {
      return (
        name
          // Remove emojis from the end
          .replace(
            /([\uD800-\uDBFF]|[\u2702-\u27B0]|[\uF680-\uF6C0]|[\u24C2-\uF251])+$/,
            "",
          )
          // Replace emojis in the middle with hyphens
          .replaceAll(
            /([\uD800-\uDBFF]|[\u2702-\u27B0]|[\uF680-\uF6C0]|[\u24C2-\uF251])+/g,
            "-",
          )
          .trim()
      )
    }
  }
}

const getOptimalFont = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxPx: number = 20,
): string => {
  let optimalSize = 1 // Start from a minimum size

  // Iterate backwards from the max limit for a quicker check
  for (let size = maxPx; size >= 1; size--) {
    // Temporarily set the font to the current size for measurement
    // Note: We use 'sans-serif' here, ensure this matches your drawing font.
    ctx.font = `bold ${size}px sans-serif`

    // Measure the width of the text
    const textMetrics = ctx.measureText(text)
    const textWidth = textMetrics.width

    // Check if the text fits within the maximum available width
    if (textWidth <= maxWidth) {
      optimalSize = size
      break // Found the largest size that fits, so we stop.
    }
  }

  // Ensure the returned size is not less than a minimum (e.g., 1px)
  const fontSize = Math.max(1, optimalSize)

  return `${fontSize}px Roboto`
}
