export function fillRoundRect(ctx, x, y, width, height, radius) {
  const maxRadius = Math.min(width / 2, height / 2)
  radius = Math.min(radius, maxRadius)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0) // Top-right
  ctx.lineTo(x + width, y + height - radius)
  ctx.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2) // Bottom-right
  ctx.lineTo(x + radius, y + height)
  ctx.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI) // Bottom-left
  ctx.lineTo(x, y + radius)
  ctx.arc(x + radius, y + radius, radius, Math.PI, (Math.PI * 3) / 2) // Top-left
  ctx.closePath()
  ctx.fill()
}
