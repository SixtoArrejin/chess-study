# Storyboard: Chess Study Promo Video

**Format**: Landscape (1920x1080)
**Duration**: 45.0 seconds
**FPS**: 60

---

## Narrative & Visual Beats

### Beat 1: Apertura (0.0s - 5.0s)
- **Concept**: A clean, premium dark opening introducing the brand.
- **Visuals**: 
  - Pure black background.
  - White logo without background (`assets/logo-sin-fondo.png`) appears in the center, starting large and scaling down smoothly (e.g. scale 1.5 -> 1.0) with an elastic/smooth ease.
  - Large minimal typography fades in at 1.5s: *"Estudiar ajedrez solía ser incómodo... hasta ahora."*
  - Complete fade-out of logo and text at 4.5s.
- **Text Overlay**: *"Estudiar ajedrez solía ser incómodo... hasta ahora."*
- **Aesthetic**: Apple-like minimalist mystery.

### Beat 2: Layout Dividido (5.0s - 15.0s)
- **Concept**: Reveal the core dual-panel layout inside a laptop/notebook frame.
- **Visuals**:
  - Transition in: The web interface (originally Light Mode with Emerald board) is revealed inside a styled laptop mockup using a smooth 3D CSS transform (rotation and scale transition).
  - The right panel (`PdfPanel`) shows pages 77 and 78 of Roberto Grau's *Tratado General de Ajedrez Tomo I*.
  - Scroll effect: At 6.5s, the PDF panel smoothly scrolls vertically to read from the top of page 77 down to page 78.
  - Borde brillante: At 9.0s, the left panel (`ChessPanel`) gets a subtle glowing `box-shadow` border to highlight its presence.
  - Text overlay fades in at 6.0s: *"Tu bibliografía y tu tablero. En una sola pantalla."*
- **Text Overlay**: *"Tu bibliografía y tu tablero. En una sola pantalla."*

### Beat 3: Modo Edición (15.0s - 25.0s)
- **Concept**: Demonstrate the ease of setting up positions.
- **Visuals**:
  - Smooth camera zoom (CSS scale and translation) focusing on the ChessPanel (left side).
  - Highlight the board mode header: "MODO LIBRE: EDITOR DE TABLERO" (a subtle yellow/blue glowing border).
  - Animate the entry of the `PiecePalette` panel sliding in.
  - Drag & Drop simulation: Clone a White Pawn from the palette, position it absolutely, and animate its translation (X, Y) smoothly to a vacant square on the board (e.g., e4).
  - Once dropped, the Pawn appears on the square and the floating clone fades out.
  - Text overlay fades in at 16.0s: *"Recreá posiciones de los libros en segundos."*
- **Text Overlay**: *"Recreá posiciones de los libros en segundos."*

### Beat 4: Modo Análisis (25.0s - 35.0s)
- **Concept**: Show interactive analysis.
- **Visuals**:
  - Slide out the `PiecePalette` and show mode switching.
  - Board pieces move: Select a White Knight (e.g., f3) and translate it to a new square (e.g., e5). Then move a Black Pawn (e.g., d6).
  - Flash effect: Origin and destination squares flash green/blue (`background-color`) when a move is executed to draw attention.
  - Text overlay fades in at 26.0s: *"Analizá variantes sin perder la página."*
- **Text Overlay**: *"Analizá variantes sin perder la página."*

### Beat 5: Personalización (35.0s - 40.0s)
- **Concept**: Dark Mode and Theme customizability.
- **Visuals**:
  - Quick zoom-out (camera reset) to show the full dual-panel web interface.
  - Animate the Settings Menu sliding in from the right edge.
  - Trigger transition: Transition the body class from `theme-light` to `theme-dark` while smoothly swapping the board color variables from Emerald (`#769656`) to Ocean (`#4b7399`). The background transitions to the deep indigo black.
  - Text overlay fades in at 36.0s: *"Adaptable a tu estilo."*
- **Text Overlay**: *"Adaptable a tu estilo."*

### Beat 6: Cierre (40.0s - 45.0s)
- **Concept**: Outro with call to action.
- **Visuals**:
  - The laptop web UI scales down and rotates backwards into the dark background, fading out.
  - Clean black background.
  - The app logo (`assets/logo-sin-fondo.png`) fades in and scales slightly, centered above the main title: *"Chess Study."*
  - Subtitle fades in: *"Mejorá tu juego hoy."*
  - Bottom URL fades in: *"my-chess-study.vercel.app"*
- **Text Overlay**: *"Chess Study. Mejorá tu juego hoy. my-chess-study.vercel.app"*
