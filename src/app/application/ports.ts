import type { Game } from "../domain/game.js";
export interface SaveRepository {
  load(): Promise<Game | null>;
  save(game: Game): Promise<void>;
  replace?(game: Game): Promise<Game>;
}
