// Helper para gestión de efectos de sonido de ajedrez

class SoundManager {
  constructor() {
    this.enabled = true;
    this.moveAudio = null;
    this.captureAudio = null;
    this.initAudio();
  }

  initAudio() {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      this.moveAudio = new Audio(`${cleanBase}sounds/move.mp3`);
      this.captureAudio = new Audio(`${cleanBase}sounds/capture.mp3`);
      this.moveAudio.preload = 'auto';
      this.captureAudio.preload = 'auto';
    } catch (e) {
      console.warn('Error inicializando audio:', e);
    }
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  getEnabled() {
    return this.enabled;
  }

  playMoveSound(isCapture = false) {
    if (!this.enabled) return;

    const audioToPlay = isCapture ? this.captureAudio : this.moveAudio;
    const fallbackPath = isCapture ? 'sounds/capture.mp3' : 'sounds/move.mp3';

    try {
      if (audioToPlay) {
        // Clonar nodo para permitir reproducción rápida y fluida sin solapamientos bloqueados
        const sound = audioToPlay.cloneNode();
        sound.volume = 0.75;
        const playPromise = sound.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Ignorar errores de políticas de autoplay del navegador si aún no hubo interacción
          });
        }
      } else {
        const baseUrl = import.meta.env.BASE_URL || '/';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const audio = new Audio(`${cleanBase}${fallbackPath}`);
        audio.volume = 0.75;
        audio.play().catch(() => {});
      }
    } catch {
      // Manejar silenciosamente
    }
  }
}

export const soundManager = new SoundManager();
export default soundManager;
