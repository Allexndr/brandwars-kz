# BrandWars 2D Asset Style Bible

## Style

- Clean premium cartoon pixel art
- Camera: three-quarter / isometric 2D
- Sprite size: 64×64 px (heroes), 48×48 px (citizens)
- Palette: 28 shared colors (see `palette.json`)
- Outline: dark navy, 1 px
- Shadows: one hard shadow tone
- Lighting: upper-left
- Background: transparent PNG
- Emotion: friendly, playful, non-aggressive
- **No** text, logos, watermarks, or weapons

## Rendering on web

```css
.pixel-art {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

Use integer scale only: ×2, ×3, or ×4.

## Animation cycles

| Cycle     | Frames | Duration |
|-----------|--------|----------|
| idle      | 4      | 1–2 s    |
| walk      | 6–8    | 1 s      |
| celebrate | 6–8    | 1–1.5 s  |

## Attachment points (characters)

```text
head, back, right_hand, left_hand, chest, feet, vehicle
```

## File layout

```text
assets/
  characters/base/     # 6 archetypes
  categories/{slug}/   # leader, citizens, props, buildings, effects
  map/tiles/           # continent backgrounds
  ui/                  # category icons, badges
```

## MVP minimum per category

- 1 leader sprite
- 2 citizen sprites
- 3–5 props
- 2 buildings
- 1 moving object / effect
- 1 idle cycle

## License

Kenney CC0 base assets may be modified. AI-generated assets are project-owned.
