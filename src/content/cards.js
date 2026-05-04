export const DECK_SIZE = 15;

export const cardDefinitions = {
  "rook.guardian_strike": attack("rook", "Guardian Strike", 1, "Deal 5 damage. Gain 5 threat.", [
    damage(5),
    threat(5),
  ]),
  "rook.shield_bash": attack("rook", "Shield Bash", 2, "Deal 7 damage. Gain 3 block.", [
    damage(7),
    block(3),
  ]),
  "rook.iron_cleave": attack("rook", "Iron Cleave", 3, "Deal 10 damage.", [damage(10)]),
  "rook.reprisal": attack("rook", "Reprisal", 2, "Deal damage equal to half your block.", [
    { type: "damageFromBlock", divisor: 2 },
  ]),

  "rook.raise_shield": defend("rook", "Raise Shield", 1, "Gain 8 block.", [block(8)]),
  "rook.guardian_wall": defend("rook", "Guardian Wall", 2, "Both players gain 5 block.", [blockAll(5)]),
  "rook.stone_stance": defend("rook", "Stone Stance", 2, "Gain 12 block. Gain 4 threat.", [
    block(12),
    threat(4),
  ]),
  "rook.intercept": defend("rook", "Intercept", 3, "Your ally gains 10 block. You gain 5 threat.", [
    blockAlly(10),
    threat(5),
  ]),

  "rook.field_mending": heal("rook", "Field Mending", 2, "Heal the lowest-health player for 8.", [
    healLowest(8),
  ]),
  "rook.commanding_roar": support("rook", "Commanding Roar", 1, "Both players draw 1. You gain 3 threat.", [
    drawAll(1),
    threat(3),
  ]),

  "rook.anchor_oath": unique("rook", "Anchor Oath", 2, "Gain 9 block. Reduce ally threat by 4.", [
    block(9),
    reduceAllyThreat(4),
  ]),
  "rook.taunting_banner": unique("rook", "Taunting Banner", 1, "Gain 8 threat. Monster is Weakened 2.", [
    threat(8),
    weaken(2),
  ]),
  "rook.fortress_heart": unique("rook", "Fortress Heart", 4, "Both players gain 12 block.", [blockAll(12)]),
  "rook.last_bastion": unique("rook", "Last Bastion", 3, "Heal yourself for 5. Gain 10 block.", [
    healSelf(5),
    block(10),
  ]),
  "rook.break_the_charge": unique("rook", "Break the Charge", 4, "Deal 12 damage. Monster is Weakened 4.", [
    damage(12),
    weaken(4),
  ]),

  "lyra.quick_shot": attack("lyra", "Quick Shot", 1, "Deal 4 damage. Draw 1.", [
    damage(4),
    drawSelf(1),
  ]),
  "lyra.ember_lance": attack("lyra", "Ember Lance", 2, "Deal 8 spell damage.", [damage(8, "spell")]),
  "lyra.twin_cut": attack("lyra", "Twin Cut", 2, "Deal 4 damage twice.", [damage(4), damage(4)]),
  "lyra.marked_pierce": attack("lyra", "Marked Pierce", 3, "Deal 9 damage. If Exposed, deal +4.", [
    { type: "damage", amount: 9, exposedBonus: 4 },
  ]),

  "lyra.smoke_step": defend("lyra", "Smoke Step", 1, "Gain 5 block. Reduce your threat by 3.", [
    block(5),
    reduceThreat(3),
  ]),
  "lyra.mirage_guard": defend("lyra", "Mirage Guard", 2, "Gain 8 block. Monster is Weakened 1.", [
    block(8),
    weaken(1),
  ]),
  "lyra.silver_feint": defend("lyra", "Silver Feint", 2, "Gain 6 block. Draw 1.", [
    block(6),
    drawSelf(1),
  ]),
  "lyra.vanish": defend("lyra", "Vanish", 3, "Gain 10 block. Reduce your threat by 6.", [
    block(10),
    reduceThreat(6),
  ]),

  "lyra.warm_light": heal("lyra", "Warm Light", 2, "Heal both players for 4.", [healAll(4)]),
  "lyra.spot_weakness": support("lyra", "Spot Weakness", 1, "Expose the monster. The next hit deals +3.", [
    expose(3),
  ]),

  "lyra.ember_veil": unique("lyra", "Ember Veil", 2, "Deal 5 spell damage. Reduce your threat by 4.", [
    damage(5, "spell"),
    reduceThreat(4),
  ]),
  "lyra.hunters_tempo": unique("lyra", "Hunter's Tempo", 1, "Draw 2 cards.", [drawSelf(2)]),
  "lyra.pinpoint_flurry": unique("lyra", "Pinpoint Flurry", 4, "Deal 15 damage. Gain 3 threat.", [
    damage(15),
    threat(3),
  ]),
  "lyra.afterimage": unique("lyra", "Afterimage", 2, "Both players reduce threat by 3.", [reduceAllThreat(3)]),
  "lyra.finishing_spark": unique("lyra", "Finishing Spark", 5, "Deal 18 damage. If monster has 25 or less HP, deal +8.", [
    { type: "executeDamage", amount: 18, threshold: 25, bonus: 8 },
  ]),

  // Captain Virex - Space Pirates / Opportunist
  // Salvage theme: trades hits for cards, leans on Exposed bonuses, manipulates threat.
  "virex.cutlass_sweep": attack("virex", "Cutlass Sweep", 1, "Deal 5 damage. Draw 1.", [
    damage(5),
    drawSelf(1),
  ]),
  "virex.plasma_volley": attack("virex", "Plasma Volley", 2, "Deal 4 damage twice.", [
    damage(4),
    damage(4),
  ]),
  "virex.boarding_charge": attack("virex", "Boarding Charge", 2, "Deal 7 damage. Gain 4 threat.", [
    damage(7),
    threat(4),
  ]),
  "virex.opportunist_strike": attack("virex", "Opportunist Strike", 3, "Deal 8 damage. If Exposed, deal +5.", [
    { type: "damage", amount: 8, exposedBonus: 5 },
  ]),
  "virex.fleet_broadside": attack("virex", "Fleet Broadside", 4, "Deal 13 damage.", [damage(13)]),

  "virex.smoke_canister": defend("virex", "Smoke Canister", 1, "Gain 5 block. Reduce your threat by 2.", [
    block(5),
    reduceThreat(2),
  ]),
  "virex.hull_plating": defend("virex", "Hull Plating", 2, "Gain 9 block.", [block(9)]),
  "virex.ducking_volley": defend("virex", "Ducking Volley", 2, "Gain 6 block. Draw 1.", [
    block(6),
    drawSelf(1),
  ]),

  "virex.field_dressing": heal("virex", "Field Dressing", 2, "Heal the lowest-health player for 7.", [
    healLowest(7),
  ]),

  "virex.salvage_right": support("virex", "Salvage Right", 1, "Both players draw 1.", [drawAll(1)]),
  "virex.mark_the_prize": support("virex", "Mark the Prize", 1, "Expose the monster. The next hit deals +4.", [
    expose(4),
  ]),

  "virex.fleet_rally": unique("virex", "Fleet Rally", 2, "Draw 2 cards. Both players reduce threat by 2.", [
    drawSelf(2),
    reduceAllThreat(2),
  ]),
  "virex.scattershot": unique("virex", "Scattershot", 2, "Deal 6 damage. Expose the monster (+3 to next hit).", [
    damage(6),
    expose(3),
  ]),
  "virex.cut_and_run": unique("virex", "Cut and Run", 3, "Deal 9 damage. Reduce your threat by 5.", [
    damage(9),
    reduceThreat(5),
  ]),
  "virex.captains_gambit": unique("virex", "Captain's Gambit", 5, "Deal 16 damage. If monster has 35 or less HP, deal +6.", [
    { type: "executeDamage", amount: 16, threshold: 35, bonus: 6 },
  ]),

  // Elyra Rootweaver - Bionic Nature Elves / Builder
  // Living-engineering theme: stacks block, threads heals, weakens with sap, turns wards into payoff.
  "elyra.sap_pulse": attack("elyra", "Sap Pulse", 1, "Deal 4 damage. Monster is Weakened 1.", [
    damage(4),
    weaken(1),
  ]),
  "elyra.bramble_lash": attack("elyra", "Bramble Lash", 2, "Deal 6 damage. Gain 4 block.", [
    damage(6),
    block(4),
  ]),
  "elyra.heartwood_strike": attack("elyra", "Heartwood Strike", 3, "Deal damage equal to half your block.", [
    { type: "damageFromBlock", divisor: 2 },
  ]),
  "elyra.canopy_bind": attack("elyra", "Canopy Bind", 3, "Deal 8 damage. Monster is Weakened 3.", [
    damage(8),
    weaken(3),
  ]),

  "elyra.heartwood_brace": defend("elyra", "Heartwood Brace", 1, "Gain 8 block.", [block(8)]),
  "elyra.living_ward": defend("elyra", "Living Ward", 2, "Both players gain 5 block.", [blockAll(5)]),
  "elyra.rootweave": defend("elyra", "Rootweave", 2, "Gain 11 block. Monster is Weakened 1.", [
    block(11),
    weaken(1),
  ]),
  "elyra.thornwall": defend("elyra", "Thornwall", 3, "Your ally gains 9 block. You gain 5 block.", [
    blockAlly(9),
    block(5),
  ]),

  "elyra.sapflow": heal("elyra", "Sapflow", 2, "Heal both players for 4.", [healAll(4)]),
  "elyra.greenheart_bloom": heal("elyra", "Greenheart Bloom", 3, "Heal the lowest-health player for 10.", [
    healLowest(10),
  ]),

  "elyra.canopy_council": support("elyra", "Canopy Council", 1, "Both players draw 1. Both players reduce threat by 2.", [
    drawAll(1),
    reduceAllThreat(2),
  ]),
  "elyra.spirit_engine": support("elyra", "Spirit Engine", 2, "Expose the monster (+3 to next hit). Both players draw 1.", [
    expose(3),
    drawAll(1),
  ]),

  "elyra.golem_summon": unique("elyra", "Golem Summon", 3, "Both players gain 9 block. Heal yourself for 3.", [
    blockAll(9),
    healSelf(3),
  ]),
  "elyra.ancient_grove": unique("elyra", "Ancient Grove", 4, "Both players gain 14 block.", [blockAll(14)]),
  "elyra.thornharvest": unique("elyra", "Thornharvest", 4, "Deal damage equal to your block. Gain 6 block.", [
    { type: "damageFromBlock", divisor: 1 },
    block(6),
  ]),

  // Gorath Deepbreaker - Abyssal Orcs / Berserker
  // Pressure / harpoon theme: heavy damage, exposed combos, executes when prey is bleeding.
  "gorath.harpoon_throw": attack("gorath", "Harpoon Throw", 1, "Deal 6 damage. Gain 3 threat.", [
    damage(6),
    threat(3),
  ]),
  "gorath.crushgrip": attack("gorath", "Crushgrip", 2, "Deal 9 damage.", [damage(9)]),
  "gorath.bonebreak_volley": attack("gorath", "Bonebreak Volley", 2, "Deal 5 damage. Expose the monster (+3 to next hit).", [
    damage(5),
    expose(3),
  ]),
  "gorath.tide_lung": attack("gorath", "Tide Lung", 3, "Deal 11 water damage. If Exposed, deal +5.", [
    { type: "damage", amount: 11, exposedBonus: 5, element: "water" },
  ]),
  "gorath.deep_strike": attack("gorath", "Deep Strike", 3, "Deal 12 damage. Gain 5 threat.", [
    damage(12),
    threat(5),
  ]),
  "gorath.leviathan_slam": attack("gorath", "Leviathan Slam", 4, "Deal 15 damage. Monster is Weakened 2.", [
    damage(15),
    weaken(2),
  ]),

  "gorath.scaleguard": defend("gorath", "Scaleguard", 1, "Gain 7 block. Gain 3 threat.", [
    block(7),
    threat(3),
  ]),
  "gorath.brace_for_pressure": defend("gorath", "Brace for Pressure", 2, "Gain 10 block. Monster is Weakened 1.", [
    block(10),
    weaken(1),
  ]),

  "gorath.blood_meal": heal("gorath", "Blood Meal", 2, "Heal yourself for 8.", [healSelf(8)]),

  "gorath.abyssal_roar": support("gorath", "Abyssal Roar", 1, "Gain 6 threat. Monster is Weakened 2.", [
    threat(6),
    weaken(2),
  ]),

  "gorath.pressurize": unique("gorath", "Pressurize", 2, "Gain 7 block. Expose the monster (+4 to next hit).", [
    block(7),
    expose(4),
  ]),
  "gorath.frenzy_charge": unique("gorath", "Frenzy Charge", 2, "Deal 8 damage. Draw 1.", [
    damage(8),
    drawSelf(1),
  ]),
  "gorath.predator_lock": unique("gorath", "Predator Lock", 3, "Deal 10 damage. Gain 6 threat.", [
    damage(10),
    threat(6),
  ]),
  "gorath.crush_depth": unique("gorath", "Crush Depth", 4, "Deal 14 water damage. Monster is Weakened 3.", [
    damage(14, "water"),
    weaken(3),
  ]),
  "gorath.deepbreaker_finish": unique("gorath", "Deepbreaker Finish", 5, "Deal 17 damage. If monster has 30 or less HP, deal +10.", [
    { type: "executeDamage", amount: 17, threshold: 30, bonus: 10 },
  ]),
};

export const starterDecks = {
  rook: [
    "rook.guardian_strike",
    "rook.shield_bash",
    "rook.iron_cleave",
    "rook.reprisal",
    "rook.raise_shield",
    "rook.guardian_wall",
    "rook.stone_stance",
    "rook.intercept",
    "rook.field_mending",
    "rook.commanding_roar",
    "rook.anchor_oath",
    "rook.taunting_banner",
    "rook.fortress_heart",
    "rook.last_bastion",
    "rook.break_the_charge",
  ],
  lyra: [
    "lyra.quick_shot",
    "lyra.ember_lance",
    "lyra.twin_cut",
    "lyra.marked_pierce",
    "lyra.smoke_step",
    "lyra.mirage_guard",
    "lyra.silver_feint",
    "lyra.vanish",
    "lyra.warm_light",
    "lyra.spot_weakness",
    "lyra.ember_veil",
    "lyra.hunters_tempo",
    "lyra.pinpoint_flurry",
    "lyra.afterimage",
    "lyra.finishing_spark",
  ],
  virex: [
    "virex.cutlass_sweep",
    "virex.plasma_volley",
    "virex.boarding_charge",
    "virex.opportunist_strike",
    "virex.fleet_broadside",
    "virex.smoke_canister",
    "virex.hull_plating",
    "virex.ducking_volley",
    "virex.field_dressing",
    "virex.salvage_right",
    "virex.mark_the_prize",
    "virex.fleet_rally",
    "virex.scattershot",
    "virex.cut_and_run",
    "virex.captains_gambit",
  ],
  elyra: [
    "elyra.sap_pulse",
    "elyra.bramble_lash",
    "elyra.heartwood_strike",
    "elyra.canopy_bind",
    "elyra.heartwood_brace",
    "elyra.living_ward",
    "elyra.rootweave",
    "elyra.thornwall",
    "elyra.sapflow",
    "elyra.greenheart_bloom",
    "elyra.canopy_council",
    "elyra.spirit_engine",
    "elyra.golem_summon",
    "elyra.ancient_grove",
    "elyra.thornharvest",
  ],
  gorath: [
    "gorath.harpoon_throw",
    "gorath.crushgrip",
    "gorath.bonebreak_volley",
    "gorath.tide_lung",
    "gorath.deep_strike",
    "gorath.leviathan_slam",
    "gorath.scaleguard",
    "gorath.brace_for_pressure",
    "gorath.blood_meal",
    "gorath.abyssal_roar",
    "gorath.pressurize",
    "gorath.frenzy_charge",
    "gorath.predator_lock",
    "gorath.crush_depth",
    "gorath.deepbreaker_finish",
  ],
};

export function getCardDefinition(cardId) {
  const card = cardDefinitions[cardId];
  if (!card) {
    throw new Error(`Unknown card: ${cardId}`);
  }

  return card;
}

function attack(classId, name, cost, text, actions) {
  return card(classId, name, "attack", cost, text, actions, "monster");
}

function defend(classId, name, cost, text, actions) {
  return card(classId, name, "defense", cost, text, actions, "self");
}

function heal(classId, name, cost, text, actions) {
  return card(classId, name, "healing", cost, text, actions, "team");
}

function support(classId, name, cost, text, actions) {
  return card(classId, name, "support", cost, text, actions, "team");
}

function unique(classId, name, cost, text, actions) {
  return card(classId, name, "unique", cost, text, actions, "special");
}

function card(classId, name, role, cost, text, actions, target) {
  const id = `${classId}.${slug(name)}`;
  return {
    id,
    name,
    classId,
    role,
    kind: "action",
    cost,
    target,
    text,
    actions,
  };
}

function slug(name) {
  return name.toLowerCase().replaceAll("'", "").replaceAll(" ", "_");
}

function damage(amount, element) {
  const action = { type: "damage", amount };
  if (element) {
    action.element = element;
  }
  return action;
}

function block(amount) {
  return { type: "block", amount, target: "self" };
}

function blockAll(amount) {
  return { type: "block", amount, target: "all" };
}

function blockAlly(amount) {
  return { type: "block", amount, target: "ally" };
}

function healSelf(amount) {
  return { type: "heal", amount, target: "self" };
}

function healLowest(amount) {
  return { type: "heal", amount, target: "lowest" };
}

function healAll(amount) {
  return { type: "heal", amount, target: "all" };
}

function drawSelf(count) {
  return { type: "draw", count, target: "self" };
}

function drawAll(count) {
  return { type: "draw", count, target: "all" };
}

function threat(amount) {
  return { type: "threat", amount, target: "self" };
}

function reduceThreat(amount) {
  return { type: "reduceThreat", amount, target: "self" };
}

function reduceAllyThreat(amount) {
  return { type: "reduceThreat", amount, target: "ally" };
}

function reduceAllThreat(amount) {
  return { type: "reduceThreat", amount, target: "all" };
}

function weaken(amount) {
  return { type: "weaken", amount };
}

function expose(amount) {
  return { type: "expose", amount };
}
