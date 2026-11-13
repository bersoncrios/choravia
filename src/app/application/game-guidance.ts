import { activeCreature, distance, elementalMultiplier, ELEMENT_NAMES, REGION_NAMES, REGION_PORTALS, RESONANCE_SEALS, SPECIES, SKILL_NAMES, species, type Game } from "../domain/game.js";

export interface Guidance { title: string; detail: string }

export function explorationObjective(game: Game): Guidance {
  if (activeCreature(game).hp <= 0)
    return { title: "Recupere seu Eco", detail: "Aproxime-se do ponto de recuperação e use Recuperar para seguir explorando." };
  if (game.captured === 0)
    return { title: "Forme seu primeiro vínculo", detail: "Explore a grama clara. Na batalha, enfraqueça o Eco sem zerar seus PV para usar Vínculo." };
  if (!game.ancientMarkerHeard) {
    const seal = RESONANCE_SEALS[game.resonanceStep ?? 0];
    if (seal) {
      const element = ELEMENT_NAMES[seal.element];
      const ownsElement = game.collection.some(c => species(c.speciesId).element === seal.element);
      return { title: `Desperte o selo de ${element}`, detail: ownsElement
        ? `Na Clareira Antiga, aproxime-se do selo com um Eco de ${element} ativo. Selos: ${game.resonanceStep ?? 0}/${RESONANCE_SEALS.length}.`
        : `Forme um vínculo com um Eco de ${element} para ativar o próximo selo na Clareira Antiga.` };
    }
  }
  const count = new Set(game.collection.map(c => c.speciesId)).size;
  if (count < SPECIES.length)
    return { title: `Conheça todos os Ecos · ${count}/${SPECIES.length}`, detail: "Explore a grama das regiões e forme vínculos com espécies que ainda faltam na sua coleção." };
  const destination = REGION_PORTALS[game.region ?? "clearing"].target;
  return { title: `Explore ${REGION_NAMES[destination]}`, detail: "Siga o portal da região. Encontre vasos, desafie duelistas e fortaleça seus Ecos." };
}

export function battleGuidance(game: Game, action: string): Guidance | null {
  const b = game.battle;
  if (!b || game.scene !== "battle") return null;
  if (b.mode === "classic") {
    const ally = species(b.ally.speciesId), enemy = species(b.enemy.speciesId);
    const factor = elementalMultiplier(ally.element, enemy.element);
    return { title: "Escolha uma ação para esta rodada", detail: `Ataque: dano neutro. ${SKILL_NAMES[ally.id]}: ${ELEMENT_NAMES[ally.element]} contra ${ELEMENT_NAMES[enemy.element]} · ${factor > 1 ? "super eficaz (×1,5)" : factor < 1 ? "pouco eficaz (×0,75)" : "efetividade normal (×1)"}. ${(b.allyCooldown ?? 0) > 0 ? "Habilidade em recarga: use outra ação nesta rodada." : "Habilidade pronta; após usá-la, espere uma rodada para repetir."} Defender reduz pela metade o próximo ataque. Uma captura que falha permite a resposta do adversário.` };
  }
  const adjacent = distance(b.ally.pos, b.enemy.pos) === 1;
  if (action === "move")
    return { title: "Mover · 1 casa", detail: b.moved
      ? "Você já se moveu neste turno. Escolha atacar, usar habilidade, defender, capturar ou fugir."
      : "Escolha uma casa vizinha livre na horizontal ou vertical. Diagonais não contam. Depois de mover, você ainda pode agir." };
  if (action === "basic")
    return { title: "Atacar · alcance de 1 casa", detail: `${adjacent ? "O inimigo está ao alcance. Toque na casa dele para atacar." : "O inimigo está fora do alcance. Mova-se para uma casa ao lado dele antes de atacar."} O ataque básico é neutro, sem vantagem elemental. Zerar os PV encerra a chance de captura.` };
  const ally = species(b.ally.speciesId), enemy = species(b.enemy.speciesId);
  const multiplier = elementalMultiplier(ally.element, enemy.element);
  const matchup = multiplier > 1 ? "Vantagem elemental · ×1,5" : multiplier < 1 ? "Desvantagem elemental · ×0,75" : "Efetividade normal · ×1";
  return { title: `${ally.id === "WW001" ? "Faísca" : "Estalo"} · alvo a 1 casa`, detail: `Escolha uma casa vizinha na horizontal ou vertical. ${ELEMENT_NAMES[ally.element]} contra ${ELEMENT_NAMES[enemy.element]}: ${matchup}. ${ally.id === "WW001" ? "Faísca atinge a casa escolhida e queima a grama." : "Estalo percorre a água conectada à casa escolhida e pode atingir seu próprio Eco."}` };
}
