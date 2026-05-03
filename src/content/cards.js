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
  "lyra.ember_lance": attack("lyra", "Ember Lance", 2, "Deal 8 damage.", [damage(8)]),
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

  "lyra.ember_veil": unique("lyra", "Ember Veil", 2, "Deal 5 damage. Reduce your threat by 4.", [
    damage(5),
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

function damage(amount) {
  return { type: "damage", amount };
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
