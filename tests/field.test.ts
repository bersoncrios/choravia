import test from "node:test";
import assert from "node:assert/strict";
import { initialField, reduceField, isFieldState, fieldCycle, FIELD_DAY_MS } from "../src/app/domain/field.js";
test("renewable resources, recipe and restoration form a persistent, bounded loop", () => {
 let state = initialField(); assert.ok(isFieldState(state));
 state = reduceField(state,{type:"gather",node:"herb"},10);
 state = reduceField(state,{type:"gather",node:"sap"},10);
 assert.equal(reduceField(state,{type:"gather",node:"herb"},10),state);
 state = reduceField(state,{type:"craft"},10);
 assert.equal(state.inventory.lantern,1); assert.equal(state.inventory.herb,0);
 state = reduceField(state,{type:"restore"},10); assert.equal(state.restored,true); assert.equal(state.inventory.lantern,0);
 assert.equal(reduceField(state,{type:"restore"},10),state);
 state = reduceField(JSON.parse(JSON.stringify(state)),{type:"gather",node:"herb"},11);
 assert.equal(state.inventory.herb,2); assert.equal(state.claims.herb,11); assert.ok(isFieldState(state));
});
test("unique treasure, rotating cache and backwards cycles cannot duplicate rewards", () => {
 let state = reduceField(initialField(),{type:"treasure"},2);
 assert.equal(state.inventory.crystal,1); assert.equal(reduceField(state,{type:"treasure"},3),state);
 state = reduceField(state,{type:"gather",node:"cache"},3);
 assert.equal(state.inventory.herb,1); assert.equal(state.inventory.fruit,1);
 assert.equal(reduceField(state,{type:"gather",node:"cache"},2),state);
 assert.equal(reduceField(state,{type:"gather",node:"cache"},3),state);
 assert.equal(fieldCycle(FIELD_DAY_MS-1),0); assert.equal(fieldCycle(FIELD_DAY_MS),1);
});
test("full bags, missing ingredients and corrupt ledger never consume a claim", () => {
 const state = initialField(); state.inventory.herb=98;
 assert.equal(reduceField(state,{type:"gather",node:"herb"},2),state);
 assert.equal(state.claims.herb,-1); assert.equal(reduceField(state,{type:"craft"},2),state);
 assert.equal(isFieldState({...state,inventory:{...state.inventory,herb:100}}),false);
 assert.equal(isFieldState({...state,claims:{...state.claims,extra:1}}),false);
 assert.throws(()=>reduceField(state,{type:"craft"},NaN));
});
