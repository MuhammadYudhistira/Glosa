import type { CardColor, CardLayout, CardTurn } from "./layout"
import {
  type CardThemeId,
  DEFAULT_COVER_COLORS,
  MARK_ALPHA,
  NIGHT,
  PAPER,
  THEMES,
  starField,
} from "./themes"

/** What a card shows besides its layout: the cover, its colours, and the seed of Malam's stars. */
export type CardArt = {
  cover: CanvasImageSource | null
  /** The covers of a recap card, by slot. */
  covers?: ReadonlyArray<CanvasImageSource>
  palette: ReadonlyArray<string> | null
  seed: string
}

const GRAIN_STEP = 8
const COVER_RADIUS = 8

function turn(context: CanvasRenderingContext2D, by: CardTurn | undefined) {
  if (!by) return
  context.translate(by.x, by.y)
  context.rotate(by.angle)
  context.translate(-by.x, -by.y)
}

function rounded(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath()
  // Safari before 16 has no roundRect: a plain rectangle then.
  const round = (
    context as Partial<Pick<CanvasRenderingContext2D, "roundRect">>
  ).roundRect
  if (round) round.call(context, x, y, width, height, radius)
  else context.rect(x, y, width, height)
}

function paintBackground(
  context: CanvasRenderingContext2D,
  themeId: CardThemeId,
  width: number,
  height: number,
  art: CardArt
) {
  if (themeId === "sampul") {
    const colors = art.palette ?? DEFAULT_COVER_COLORS
    const gradient = context.createLinearGradient(0, 0, width * 0.6, height)
    colors.forEach((color, i) => {
      gradient.addColorStop(
        colors.length === 1 ? 0 : i / (colors.length - 1),
        color
      )
    })
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
    return
  }
  if (themeId === "kertas") {
    context.fillStyle = PAPER.background
    context.fillRect(0, 0, width, height)
    context.fillStyle = PAPER.grain
    for (let y = 0; y < height; y += GRAIN_STEP) {
      const shift = (y / GRAIN_STEP) % 2 === 0 ? 0 : GRAIN_STEP / 2
      for (let x = shift; x < width; x += GRAIN_STEP)
        context.fillRect(x, y, 2, 2)
    }
    return
  }
  context.fillStyle = NIGHT.background
  context.fillRect(0, 0, width, height)
  const glow = context.createRadialGradient(
    width / 2,
    height * 1.15,
    0,
    width / 2,
    height * 1.15,
    height * 0.75
  )
  glow.addColorStop(0, NIGHT.glow)
  glow.addColorStop(1, "rgba(38, 48, 106, 0)")
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)
  context.fillStyle = "#ffffff"
  for (const star of starField(art.seed, width, height)) {
    context.globalAlpha = star.alpha
    context.beginPath()
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1
}

/** Draws a laid-out card in a theme (spec kartu kutipan §3, §6.2). */
export function drawCard(
  context: CanvasRenderingContext2D,
  layout: CardLayout,
  themeId: CardThemeId,
  art: CardArt
): void {
  const theme = THEMES[themeId]
  const colors: Record<CardColor, string> = {
    text: theme.text,
    soft: theme.soft,
    accent: theme.accent,
  }
  context.save()
  paintBackground(context, themeId, layout.width, layout.height, art)
  for (const item of layout.items) {
    context.save()
    switch (item.kind) {
      case "text":
        turn(context, item.turn)
        context.font = item.font
        context.fillStyle = colors[item.color]
        context.textBaseline = "alphabetic"
        context.fillText(item.text, item.x, item.y)
        break
      case "mark":
        turn(context, item.turn)
        context.globalAlpha = MARK_ALPHA
        context.fillStyle = theme.accent
        rounded(
          context,
          item.x,
          item.y,
          item.width,
          item.height,
          item.height * 0.3
        )
        context.fill()
        break
      case "rule":
        context.fillStyle = theme.accent
        rounded(
          context,
          item.x,
          item.y,
          item.width,
          item.height,
          item.height / 2
        )
        context.fill()
        break
      case "cover": {
        const image =
          item.slot === undefined
            ? art.cover
            : (art.covers?.[item.slot] ?? null)
        if (image) {
          rounded(
            context,
            item.x,
            item.y,
            item.width,
            item.height,
            COVER_RADIUS
          )
          context.clip()
          context.drawImage(image, item.x, item.y, item.width, item.height)
        }
        break
      }
    }
    context.restore()
  }
  context.restore()
}
