# Design System: Chess Study Promo Video

## Visual Identity & Palette
- **App Theme Backgrounds**:
  - Light Mode: `hsl(220, 20%, 95%)`
  - Dark Mode: `hsl(224, 71%, 4%)` (Deep Indigo Black)
- **Glassmorphism Panels**:
  - Light mode panel: `rgba(255, 255, 255, 0.72)` with border `rgba(0, 0, 0, 0.08)`
  - Dark mode panel: `rgba(10, 15, 30, 0.68)` with border `rgba(255, 255, 255, 0.07)`
- **Board Colors (Esmeralda - Classic)**:
  - Dark squares: `#769656` (Emerald Green)
  - Light squares: `#eeeed2` (Beige/Cream)
- **Board Colors (Océano - Custom)**:
  - Dark squares: `#4b7399` (Slate Ocean Blue)
  - Light squares: `#eae9d2` (Muted Beige)
- **Text & Details**:
  - Primary (Light theme): `hsl(222, 47%, 12%)`
  - Primary (Dark theme): `hsl(210, 40%, 98%)`
  - Muted: `hsl(215, 12%, 48%)`
  - Accent Color: `hsl(210, 100%, 60%)` (Electric Blue)
- **Video Overlays**:
  - Clean sans-serif, positioned at the bottom center or top center.
  - White bold text with text-shadow to guarantee maximum contrast against light/dark themes.

## Typography
- **Primary Font**: `Outfit` (auto-loaded Google Font)
  - Weights: 300 (Light), 400 (Regular), 600 (Semi-Bold), 800 (Extra-Bold)
- **Monospace Font**: `JetBrains Mono`
  - Used for buttons and tiny data labels.

## Layout Principles
- Split Screen layout: 45% ChessPanel (Left) / 55% PdfPanel (Right) during 0:05 - 0:35.
- Simulated notebook container framing: 3D perspective with soft borders, giving the web interface a sleek hardware container look.
- Overlay text: placed dynamically using absolute positions, large and legible (80px+ titles, 24px+ body).

## Motion & Easing Guidelines
- UI Reveals: `cubic-bezier(0.34, 1.56, 0.64, 1)` (Back Out for bouncy/premium elasticity)
- Camera zooms and drags: `cubic-bezier(0.25, 1, 0.5, 1)` (Power3/Expo Out for ultra-smooth easing)
- Piece movements: `power2.inOut` (natural acceleration and deceleration)
- Page scrolling: `power1.inOut` (smooth speed ramp up and down)

## Do's & Don'ts
- **DO** use CSS filters, backdrop filters, and subtle `box-shadow` glows to draw attention to details.
- **DO** use tabular numbers for timers and moves.
- **DON'T** use literal cursor icons. Use highlight scaling and pulsing glows to convey action programmatically.
- **DON'T** create sharp color changes; transition color gradients smoothly over 0.5s.
