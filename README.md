# ♟️📖 Chess Study
### *Lector de libros de ajedrez en PDF y Tablero de Análisis interactivo en una sola pantalla.*

**Chess Study** es una aplicación web de una sola página (SPA) moderna fluida diseñada específicamente para resolver una de las fricciones más comunes de los estudiantes de ajedrez: tener que cambiar constantemente de ventanas entre un libro digital en PDF y un tablero de análisis digital. 

Al unificar un **visor de PDF de alto rendimiento** y un **tablero de ajedrez inteligente** en una interfaz interactiva de pantalla dividida (*split screen*), la aplicación te permite leer tus libros preferidos y replicar, analizar o jugar las jugadas del libro al instante, en tiempo real y sin interrupciones.

---

## ✨ Características Principales

### 🖥️ Interfaz Limpia y Layout Resizable
* **Split Screen Responsivo:** Divide la pantalla horizontalmente en dos paneles principales que puedes redimensionar arrastrando un divisor interactivo (*Resizer*). En dispositivos móviles, los paneles se apilan verticalmente de forma automática (tablero arriba, PDF abajo) aunque es recomendable su uso en PC o tablets para una mejor experiencia.
* **Estética Fluida (Glassmorphic):** Construido sobre un diseño minimalista, limpio y moderno.
* **Modo Claro y Oscuro Inteligente:** Soporte nativo y automático basado en las preferencias del sistema operativo del usuario, con posibilidad de conmutar de forma manual e instantánea en la cabecera.
* **Configuración del Tablero:** Permite invertir el orden de los paneles (PDF a la izquierda, tablero a la derecha), cambiar el estilo de las casillas (Clásico, Madera, Océano, Slate, Cyberpunk) y rotar la perspectiva de las piezas.

### 📚 Visor PDF de Nivel Profesional (PDF.js v4.2.67)
* **Fluidez Extrema (60 FPS):** Usa el motor nativo oficial de **PDF.js** dentro de un `<iframe>` de la misma procedencia (Same-Origin). Esto delega la renderización pesada a un hilo secundario (*Web Worker*) acelerado por GPU, logrando desplazamientos fluidos incluso en tomos masivos de más de 300 páginas.
* **Auto-Ajuste de Ancho Responsivo:** Las páginas se auto-ajustan a la anchura del panel en tiempo real a medida que arrastras la barra divisoria, con sincronización interactiva del zoom.
* **Persistencia Novedosa de Lectura:** 
  * **Almacenamiento Local (IndexedDB):** Tu PDF cargado se guarda localmente en el navegador, evitando tener que re-subir el archivo cada vez que abres la app.
  * **Memoria de Página:** El lector recuerda exactamente la página en la que te quedaste en tu última lectura y la posiciona al instante al recargar la pestaña.

### ♟️ Tablero de Ajedrez Inteligente con Doble Modo
* **algebraic Notation:** El tablero incluye siempre coordenadas visibles en los bordes para una lectura y ubicación espacial óptima.
* **Modo 1: Editor de Tablero (Por Defecto):**
  * Coloca o remueve libremente cualquier pieza del tablero sin restricciones legales de movimiento.
  * Paleta de piezas blancas y negras para arrastrar (*Drag & Drop*) o seleccionar tipo pincel.
  * Controles rápidos: "Limpiar tablero", "Posición Inicial de piezas" y "Girar tablero".
  * Herramienta borrador dedicada con estilo peligroso de color rojo.
* **Modo 2: Modo Juego / Análisis ("Empezar desde esta posición"):**
  * Toma la posición de tu tablero de edición, genera su FEN y te pregunta quién realiza la primera jugada (¿Juegan Blancas o Juegan Negras?).
  * Oculta la paleta de edición y activa de forma estricta las reglas oficiales de ajedrez mediante **`chess.js`**.
  * **Historial Dinámico con Figuras (FAN):** Registra las jugadas utilizando íconos universales SVG de piezas (Figurine Algebraic Notation) en lugar de iniciales en inglés, con soporte completo para partidas donde juegan negras primero (`1...`).
  * **Navegación Interactiva:** Botones integrados para ir al inicio de la partida, jugada anterior, siguiente y al final del juego para repasar variantes.
  * Botón de retorno al "Modo Editor" para continuar modificando piezas libremente.

### 🧠 Escaneo y Digitalización de Tableros con IA (Chess OCR)
* **Copiar Tablero desde el PDF en 1 Clic:** Selecciona cualquier diagrama impreso en el libro simplemente haciendo un clic sobre él. El algoritmo detecta automáticamente los límites exactos del tablero sin que tengas que ajustar las esquinas a mano.
* **Selección Manual por Recuadro:** Si el diagrama tiene leyendas o formatos irregulares, puedes arrastrar un recuadro de selección personalizado con soporte táctil y de ratón.
* **Previsualización con Foco Nítido:** Mientras confirmas la selección, el resto de la página se atenúa suavemente mediante una máscara de contraste, manteniendo el tablero recortado con nitidez absoluta para verificar la posición antes de procesarla.
* **Subida de Imágenes y Pegado desde el Portapapeles (`Ctrl+V`):** Puedes cargar capturas de pantalla desde tu galería o pegar directamente con `Ctrl+V` cualquier imagen copiada de la web o de Chess.com/Lichess.
* **Inferencia Neuronal 100% Local (Offline y Privada):** Toda la IA corre en el propio navegador mediante WebAssembly. Tus libros, fotos y lecturas nunca se suben a ningún servidor externo.

### 📖 Biblioteca de Clásicos de Roberto Grau Integrada
* ¿No tienes un libro en PDF a mano? El estado vacío de la app te ofrece **4 tarjetas** con los tomos de la obra más emblemática de la literatura en español: el **Tratado General de Ajedrez de Roberto Grau** (Tomo I al IV).
* Servidos localmente en el servidor, al pulsar sobre cualquiera de ellos la aplicación descarga y convierte el binario en un archivo virtual al vuelo, cargándolo instantáneamente con soporte de memoria de páginas e IndexedDB nativo.

---

## 🛠️ Stack Tecnológico

* **Core:** [React 19](https://react.dev/) + [Vite](https://vite.dev/) (Rápido, modular y optimizado).
* **Inteligencia Artificial y Visión:** [ONNX Runtime Web](https://onnxruntime.ai/) (Motor de inferencia de IA en WebAssembly/WASM) + [@scoriiu/fenshot](https://github.com/scoriiu/fenshot) (Clasificador neuronal CNN `chess-tiles-v2.onnx` de 1.3 MB y detector de gradientes de tablero, bajo licencia MIT por Coachess).
* **Lógica del Ajedrez:** [chess.js](https://github.com/jhlywa/chess.js) (Validación estricta de reglas oficiales de ajedrez).
* **Renderizado del Tablero:** [react-chessboard](https://github.com/Clariity/react-chessboard) (Tablero interactivo HD responsivo).
* **Motor PDF:** [PDF.js Precompiled Web Viewer v4.2.67](https://mozilla.github.io/pdf.js/) (Lector nativo de Firefox optimizado en hilo secundario).
* **Estilizado (CSS):** Vanilla CSS con HSL, variables CSS dinámicas y Tailwind CSS v4.
* **Iconografía:** [Lucide Icons](https://lucide.dev/) (Estilo de línea moderno y minimalista).

---

## 🔬 ¿Cómo Funciona el Reconocimiento de Tableros con IA?

A diferencia de otras soluciones que recurren a modelos pesados de detección de objetos tipo YOLO (de 30 a 100 MB) o que envían las capturas a servidores externos de pago, **Chess Study** utiliza una **arquitectura híbrida de alta eficiencia**:

1. **Detección Geométrica (Visión Computacional Clásica, 0 MB):**
   - Para encontrar el tablero en la página o foto, no se requiere una red neuronal pesada.
   - Un algoritmo matemático analiza los gradientes de contraste en horizontal y vertical buscando la secuencia aritmética de 7 líneas equidistantes perpendiculares que forman la cuadrícula 8x8 (basado en el método de *tensorflow_chessbot*). Es casi instantáneo y consume cero memoria.
2. **Clasificación Neuronal (Deep Learning CNN, 1.3 MB):**
   - Una vez cortadas las 64 casillas, una pequeña **Red Neuronal Convolucional (CNN)** llamada `chess-tiles-v2.onnx` (~330.000 parámetros) clasifica cada casilla en una de 13 clases posibles (vacía, o una de las 12 piezas blancas o negras).
   - Fue entrenada sintéticamente con más de **72 conjuntos de piezas** y **55 temas de tablero** (incluyendo texturas rayadas de libros y diagramas impresos antiguos), con degradaciones reales de imagen (compresión JPEG, desenfoque, ruido).
3. **Preservación de Perspectiva y FEN:**
   - En literatura y libros en PDF, los diagramas se imprimen de forma estándar con las blancas abajo (casilla a1 abajo a la izquierda). La app preserva las coordenadas naturales del diagrama (evitando falsos giros por peones avanzados o pasados) y mantiene intacta la orientación que el usuario haya seleccionado en su tablero.

---

## 📂 Estructura del Proyecto

La arquitectura sigue una estructura modular y escalable para una SPA:

```text
chess-study/
├── public/                     # Recursos estáticos del cliente
│   ├── books/                  # Tomos PDF del Tratado de Ajedrez de Roberto Grau
│   ├── models/                 # Modelo de Deep Learning (chess-tiles-v2.onnx, 1.3 MB)
│   ├── ort/                    # Binarios WebAssembly de ONNX Runtime Web
│   ├── pdfjs/                  # Distribución del visor web precompilado de PDF.js
│   ├── favicon.png             # Icono circular de la pestaña web con fondo blanco
│   └── sw.js                   # Service Worker para almacenamiento en caché local
├── src/
│   ├── assets/                 # Imagen de marca de la app (logo, hero)
│   ├── components/
│   │   ├── ChessFigurine.jsx   # Renderizado de figuras SVG en notación algebraica (FAN)
│   │   ├── ChessPanel.jsx      # Control del tablero de ajedrez, chess.js y notación
│   │   ├── PdfPanel.jsx        # Iframe de PDF.js, localBooks y comunicación bidireccional
│   │   ├── PdfSnipperOverlay.jsx # Herramienta interactiva de recorte y selección de tableros
│   │   ├── PiecePalette.jsx    # Paleta de piezas para el modo libre
│   │   └── SettingsMenu.jsx    # Panel lateral deslizante de configuraciones visuales
│   ├── helpers/
│   │   ├── chessHelpers.js     # Conversiones posicionales FEN <-> react-chessboard
│   │   ├── chessScanner.js     # Pipeline de visión por computadora y ONNX Runtime
│   │   ├── pdfStore.js         # Interfaz de persistencia IndexedDB para archivos PDF
│   │   └── soundHelper.js      # Efectos de sonido de movimientos y capturas
│   ├── App.jsx                 # Layout principal, split-screen y pegado global (Ctrl+V)
│   ├── index.css               # Estilos de vidriomorfismo (Glassmorphism), temas e indexado
│   └── main.jsx                # Punto de entrada de la aplicación React
├── package.json                # Dependencias del proyecto
└── README.md                   # Documentación y guía de uso
```

---

## 🚀 Instalación y Uso Local

Sigue estos sencillos pasos para levantar el entorno de desarrollo localmente:

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/SixtoArrejin/chess-study.git
   cd chess-study
   ```

2. **Instalar dependencias del proyecto:**
   ```bash
   npm install
   ```

3. **Ejecutar el servidor de desarrollo local:**
   ```bash
   npm run dev
   ```

4. **Acceder a la aplicación:**
   Abre tu navegador preferido e ingresa a la dirección local que te indique la terminal (por defecto, `http://localhost:5173`).

---

## 📚 Una Invitación al Estudio

El ajedrez se aprende practicando. **Chess Study** ha sido desarrollado con todo el amor y el respeto por el ajedrez clásico y moderno para ser una herramienta útil en tu camino de maestría. 

Abre el **Tomo I de Grau** directamente de las tarjetas inferiores o arrastra tu manual favorito, acomoda las piezas en el tablero y lleva tu nivel de análisis al siguiente escalón. *¡Que disfrutes tu entrenamiento!* ♟️📖
