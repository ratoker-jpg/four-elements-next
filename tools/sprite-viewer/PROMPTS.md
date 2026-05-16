# Sprite Sheet Prompt Pack

These prompts are written in English because image models usually follow English asset prompts more reliably.

Use them as starting points for generating Builder and Harvester sprite sheets that match the standalone viewer contract.

## Builder Full Sprite Sheet Prompt

Create a complete 2D sprite sheet for a sci-fi RTS Builder unit. Output a single transparent PNG sprite sheet with a fixed grid of 11 columns by 8 rows. Each frame cell is exactly 128x128 pixels, so the final image size is 1408x1024. Rows represent facing directions in this exact order: row 0 east, row 1 south-east, row 2 south, row 3 south-west, row 4 west, row 5 north-west, row 6 north, row 7 north-east. Columns represent animation frames. Builder layout: idle at start column 0 with 1 frame, move at start column 1 with 4 frames, build/work at start column 5 with 6 frames. Keep a consistent ground contact point in all frames, with the anchor around x=50% and y=84%. Keep the unit the same size in every frame. Style: soft sci-fi RTS, readable mobile RTS silhouette, hand-painted pixel-art feel, warm desert palette, cyan and blue accent details, no photorealism. The Builder should look like a utility construction vehicle or mobile worker platform with a clear tool silhouette suitable for repair or construction work.

## Harvester Full Sprite Sheet Prompt

Create a complete 2D sprite sheet for a sci-fi RTS Harvester unit. Output a single transparent PNG sprite sheet with a fixed grid of 17 columns by 8 rows. Each frame cell is exactly 128x128 pixels, so the final image size is 2176x1024. Rows represent facing directions in this exact order: row 0 east, row 1 south-east, row 2 south, row 3 south-west, row 4 west, row 5 north-west, row 6 north, row 7 north-east. Columns represent animation frames. Harvester layout: idle at start column 0 with 1 frame, move at start column 1 with 4 frames, load at start column 5 with 6 frames, unload at start column 11 with 6 frames. Keep a consistent ground contact point in all frames, with the anchor around x=50% and y=84%. Keep the unit the same size in every frame. Style: soft sci-fi RTS, readable mobile RTS silhouette, hand-painted pixel-art feel, warm desert palette, cyan and blue accent details, no photorealism. The Harvester should look like a civilian resource collection vehicle with a clear cargo, intake, or processing silhouette that reads well from gameplay distance.

## Builder Smaller POC Prompt

Create a smaller proof-of-concept 2D sprite sheet for a sci-fi RTS Builder unit. Output a single transparent PNG sprite sheet with a fixed grid, 8 direction rows, and 128x128 frame cells. Include only the most important animation coverage for quick visual validation: 1 idle frame, 4 move frames, and 3 build/work frames. Keep the same direction row order: east, south-east, south, south-west, west, north-west, north, north-east. Keep a consistent ground contact point around x=50% and y=84%, and keep the Builder the same size in every frame. Style: soft sci-fi RTS, readable mobile RTS silhouette, hand-painted pixel-art feel, warm desert palette, cyan and blue accent details, no photorealism.

## Harvester Smaller POC Prompt

Create a smaller proof-of-concept 2D sprite sheet for a sci-fi RTS Harvester unit. Output a single transparent PNG sprite sheet with a fixed grid, 8 direction rows, and 128x128 frame cells. Include only the most important animation coverage for quick visual validation: 1 idle frame, 4 move frames, 3 load frames, and 3 unload frames. Keep the same direction row order: east, south-east, south, south-west, west, north-west, north, north-east. Keep a consistent ground contact point around x=50% and y=84%, and keep the Harvester the same size in every frame. Style: soft sci-fi RTS, readable mobile RTS silhouette, hand-painted pixel-art feel, warm desert palette, cyan and blue accent details, no photorealism.

## Negative Prompt / Constraints

- no labels
- no text
- no watermark
- no background
- no grid lines
- no cropped frames
- no inconsistent scale
- no perspective changes between frames
