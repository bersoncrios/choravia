export class GameAudio {
  private context: AudioContext | null = null;
  play(success = false): void {
    try {
      this.context ??= new AudioContext();
      void this.context.resume();
      const c = this.context;
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(success ? 523 : 330, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        success ? 784 : 440,
        c.currentTime + 0.09,
      );
      g.gain.setValueAtTime(0.035, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.16);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.17);
    } catch {
      /* Audio remains optional. */
    }
  }
  close(): void {
    void this.context?.close();
  }
}
