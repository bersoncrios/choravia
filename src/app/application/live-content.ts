import { creatureMaxHp, creatureLevel, type Game } from "../domain/game.js";
import type { LiveContent, BalanceConfig } from "../domain/live-ops.js";
/** Explicit save configuration keeps reducers deterministic and ongoing battles stable. */
export function applyLiveContent(game: Game, content: LiveContent): Game {
 if (game.scene !== "exploration") return game;
 const balance: BalanceConfig = {};
 for (const entry of content.balance) balance[entry.id] = { hp: entry.hp, attack: entry.attack, defense: entry.defense };
 const owned = new Set(game.ownedItems ?? []);
 const catalog = new Map((game.shopCatalog ?? []).filter(item => owned.has(item.id)).map(item => [item.id, item]));
 for (const item of content.accessories) catalog.set(item.id, item);
 const equipped = game.avatar?.customAccessory;
 const visual = equipped ? catalog.get(equipped.id) : undefined;
 const avatar = game.avatar && visual ? { ...game.avatar, customAccessory: { id: visual.id, shape: visual.shape, color: visual.color } } : game.avatar;
 const next = { ...game, ...(avatar ? { avatar } : {}), balance, shopCatalog: [...catalog.values()], collection: game.collection.map(c => ({ ...c, hp: Math.min(c.hp, creatureMaxHp(c.speciesId, creatureLevel(c), balance)) })) };
 return JSON.stringify(next) === JSON.stringify(game) ? game : next;
}
