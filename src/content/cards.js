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
  "rook.taunting_banner": unique("rook", "Taunting Banner", 1, "Taunt the monster (+5 threat). Gain 3 additional threat.", [
    taunt(),
    threat(3),
  ]),
  "rook.fortress_heart": unique("rook", "Fortress Heart", 4, "Both players gain 12 block.", [blockAll(12)]),
  "rook.last_bastion": unique("rook", "Last Bastion", 3, "Heal yourself for 5. Gain 10 block.", [
    healSelf(5),
    block(10),
  ]),
  "rook.break_the_charge": unique("rook", "Break the Charge", 4, "Deal 14 damage.", [
    damage(14),
  ]),

  "lyra.quick_shot": attack("lyra", "Quick Shot", 1, "Deal 4 damage. Draw 1.", [
    damage(4),
    drawSelf(1),
  ]),
  "lyra.ember_lance": attack("lyra", "Ember Lance", 2, "Deal 8 spell damage.", [damage(8, "spell")]),
  "lyra.twin_cut": attack("lyra", "Twin Cut", 2, "Deal 4 damage twice.", [damage(4), damage(4)]),
  "lyra.marked_pierce": attack("lyra", "Marked Pierce", 3, "Deal 11 damage.", [
    damage(11),
  ]),

  "lyra.smoke_step": defend("lyra", "Smoke Step", 1, "Gain 5 block. Reduce your threat by 3.", [
    block(5),
    reduceThreat(3),
  ]),
  "lyra.mirage_guard": defend("lyra", "Mirage Guard", 2, "Gain 9 block. Draw 1 card.", [
    block(9),
    drawSelf(1),
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
  "lyra.spot_weakness": support("lyra", "Spot Weakness", 1, "Deal 3 spell damage. Draw 1 card.", [
    damage(3, "spell"),
    drawSelf(1),
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
  "virex.opportunist_strike": attack("virex", "Opportunist Strike", 3, "Deal 10 damage. Draw 1 card.", [
    damage(10),
    drawSelf(1),
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
  "virex.mark_the_prize": support("virex", "Mark the Prize", 1, "Deal 4 damage. Draw 1 card.", [
    damage(4),
    drawSelf(1),
  ]),

  "virex.fleet_rally": unique("virex", "Fleet Rally", 2, "Draw 2 cards. Both players reduce threat by 2.", [
    drawSelf(2),
    reduceAllThreat(2),
  ]),
  "virex.scattershot": unique("virex", "Scattershot", 2, "Deal 8 damage. Draw 1 card.", [
    damage(8),
    drawSelf(1),
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
  "elyra.sap_pulse": attack("elyra", "Sap Pulse", 1, "Deal 5 damage. Gain 2 block.", [
    damage(5),
    block(2),
  ]),
  "elyra.bramble_lash": attack("elyra", "Bramble Lash", 2, "Deal 6 damage. Gain 4 block.", [
    damage(6),
    block(4),
  ]),
  "elyra.heartwood_strike": attack("elyra", "Heartwood Strike", 3, "Deal damage equal to half your block.", [
    { type: "damageFromBlock", divisor: 2 },
  ]),
  "elyra.canopy_bind": attack("elyra", "Canopy Bind", 3, "Deal 10 damage. Gain 2 block.", [
    damage(10),
    block(2),
  ]),

  "elyra.heartwood_brace": defend("elyra", "Heartwood Brace", 1, "Gain 8 block.", [block(8)]),
  "elyra.living_ward": defend("elyra", "Living Ward", 2, "Both players gain 5 block.", [blockAll(5)]),
  "elyra.rootweave": defend("elyra", "Rootweave", 2, "Gain 12 block. Heal yourself for 2.", [
    block(12),
    healSelf(2),
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
  "elyra.spirit_engine": support("elyra", "Spirit Engine", 2, "Both players draw 2 cards.", [
    drawAll(2),
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
  "gorath.bonebreak_volley": attack("gorath", "Bonebreak Volley", 2, "Deal 7 damage. Gain 2 threat.", [
    damage(7),
    threat(2),
  ]),
  "gorath.tide_lung": attack("gorath", "Tide Lung", 3, "Deal 13 water damage.", [
    damage(13, "water"),
  ]),
  "gorath.deep_strike": attack("gorath", "Deep Strike", 3, "Deal 12 damage. Gain 5 threat.", [
    damage(12),
    threat(5),
  ]),
  "gorath.leviathan_slam": attack("gorath", "Leviathan Slam", 4, "Deal 16 damage.", [
    damage(16),
  ]),

  "gorath.scaleguard": defend("gorath", "Scaleguard", 1, "Gain 7 block. Gain 3 threat.", [
    block(7),
    threat(3),
  ]),
  "gorath.brace_for_pressure": defend("gorath", "Brace for Pressure", 2, "Gain 11 block. Gain 1 threat.", [
    block(11),
    threat(1),
  ]),

  "gorath.blood_meal": heal("gorath", "Blood Meal", 2, "Heal yourself for 8.", [healSelf(8)]),

  "gorath.abyssal_roar": support("gorath", "Abyssal Roar", 1, "Taunt the monster (+5 threat). Gain 1 additional threat.", [
    taunt(),
    threat(1),
  ]),

  "gorath.pressurize": unique("gorath", "Pressurize", 2, "Gain 9 block. Deal 3 damage.", [
    block(9),
    damage(3),
  ]),
  "gorath.frenzy_charge": unique("gorath", "Frenzy Charge", 2, "Deal 8 damage. Draw 1.", [
    damage(8),
    drawSelf(1),
  ]),
  "gorath.predator_lock": unique("gorath", "Predator Lock", 3, "Deal 10 damage. Gain 6 threat.", [
    damage(10),
    threat(6),
  ]),
  "gorath.crush_depth": unique("gorath", "Crush Depth", 4, "Deal 16 water damage.", [
    damage(16, "water"),
  ]),
  "gorath.deepbreaker_finish": unique("gorath", "Deepbreaker Finish", 5, "Deal 17 damage. If monster has 30 or less HP, deal +10.", [
    { type: "executeDamage", amount: 17, threshold: 30, bonus: 10 },
  ]),

  // Storm Forge Vanguard — Storm Charge themed.
  // "Aggression fuels power." Damage actions are tagged element="overclock"
  // so Storm Charge passive (+1 to damage when any storm-charge held) and
  // future Static Field bonuses route through them. The basic_attack /
  // basic_defend `spendToken` payloads are now live (engine resolveAction
  // consumes one token of the named type and adds bonus damage / block).
  "storm-forge.basic_attack": attack("storm-forge", "Basic Attack", 1, "Deal 1 damage. Storm passive: +1 damage with any held Storm Charge. Spend 1 token to gain +1 damage.", [
    damageWithSpend(1, "overclock", "storm-charge", 1),
  ]),
  "storm-forge.basic_defend": defend("storm-forge", "Basic Defend", 1, "Block 2 damage. Spend 1 Storm Charge token to gain +1 block.", [
    blockWithSpend(2, "storm-charge", 1),
  ]),
  "storm-forge.power_strike": attack("storm-forge", "Power Strike", 2, "Deal 3 damage. Enhanced by Storm passive.", [
    damage(3, "overclock"),
  ]),
  "storm-forge.surge_channel": attack("storm-forge", "Surge Channel", 2, "Deal 1 damage. Gain 1 Storm Charge token.", [
    damage(1, "overclock"),
    gainToken("storm-charge", 1),
  ]),
  "storm-forge.thunderclap": attack("storm-forge", "Thunderclap", 1, "Deal 3 damage. Draw 1 card.", [
    damage(3, "overclock"),
    drawSelf(1),
  ]),
  "storm-forge.arc_volley": attack("storm-forge", "Arc Volley", 2, "Deal 4 damage twice. Gain 2 threat.", [
    damage(4, "overclock"),
    damage(4, "overclock"),
    threat(2),
  ]),
  "storm-forge.static_field": defend("storm-forge", "Static Field", 2, "Gain 6 block. Gain 1 Storm Charge token.", [
    block(6),
    gainToken("storm-charge", 1),
  ]),
  "storm-forge.charged_lance": unique("storm-forge", "Charged Lance", 2, "Deal 8 damage. Gain 1 Storm Charge token.", [
    damage(8, "overclock"),
    gainToken("storm-charge", 1),
  ]),
  "storm-forge.overload_burst": unique("storm-forge", "Overload Burst", 3, "Deal 12 damage. Gain 3 threat.", [
    damage(12, "overclock"),
    threat(3),
  ]),
  "storm-forge.thunderhead_finish": unique("storm-forge", "Thunderhead Finish", 4, "Deal 14 damage. If monster has 25 or less HP, deal +8.", [
    { type: "executeDamage", amount: 14, threshold: 25, bonus: 8, element: "overclock" },
  ]),

  // Verdant Reach — Bio-Growth themed.
  // Heavy heal/threat-sink kit. The Bio-Growth passive (+1 healing) is
  // applied automatically by the engine when any token is held, so card
  // amounts here are the BASE values — don't pre-bake the bonus.
  "verdant-reach.thorn_lash": attack("verdant-reach", "Thorn Lash", 1, "Deal 4 damage. Gain 2 threat.", [
    damage(4),
    threat(2),
  ]),
  "verdant-reach.bramble_strike": attack("verdant-reach", "Bramble Strike", 2, "Deal 6 damage. Gain 3 threat.", [
    damage(6),
    threat(3),
  ]),
  "verdant-reach.heartwood_smash": attack("verdant-reach", "Heartwood Smash", 3, "Deal damage equal to your block.", [
    { type: "damageFromBlock", divisor: 1 },
  ]),

  "verdant-reach.bark_brace": defend("verdant-reach", "Bark Brace", 1, "Gain 8 block.", [
    block(8),
  ]),
  "verdant-reach.living_thicket": defend("verdant-reach", "Living Thicket", 2, "Both players gain 6 block.", [
    blockAll(6),
  ]),
  "verdant-reach.taproot_stance": defend("verdant-reach", "Taproot Stance", 2, "Gain 10 block. Gain 4 threat.", [
    block(10),
    threat(4),
  ]),

  "verdant-reach.greenheart_pulse": heal("verdant-reach", "Greenheart Pulse", 1, "Heal the lowest-health player for 5.", [
    healLowest(5),
  ]),
  "verdant-reach.canopy_bloom": heal("verdant-reach", "Canopy Bloom", 2, "Heal both players for 5.", [
    healAll(5),
  ]),
  "verdant-reach.sap_renewal": heal("verdant-reach", "Sap Renewal", 2, "Heal yourself for 9.", [
    healSelf(9),
  ]),
  "verdant-reach.world_root_mend": heal("verdant-reach", "World-Root Mend", 3, "Heal the lowest-health player for 11.", [
    healLowest(11),
  ]),

  "verdant-reach.guardian_call": support("verdant-reach", "Guardian Call", 1, "Taunt the monster (+5 threat). Both players draw 1.", [
    taunt(),
    drawAll(1),
  ]),
  "verdant-reach.thornward": unique("verdant-reach", "Thornward", 2, "Gain 7 block. Heal yourself for 4.", [
    block(7),
    healSelf(4),
  ]),
  "verdant-reach.standing_stone": unique("verdant-reach", "Standing Stone", 3, "Both players gain 8 block. Heal both players for 3.", [
    blockAll(8),
    healAll(3),
  ]),
  "verdant-reach.bloomtide": unique("verdant-reach", "Bloomtide", 3, "Heal both players for 6. Reduce ally threat by 4.", [
    healAll(6),
    reduceAllyThreat(4),
  ]),
  "verdant-reach.ancient_oath": unique("verdant-reach", "Ancient Oath", 4, "Heal both players for 8. You gain 6 threat.", [
    healAll(8),
    threat(6),
  ]),

  // Tideflow Engineer — Hydroflow themed.
  // Threat-redirect, soft control, support. moveThreat is the signature
  // verb. Hydroflow passive (held → reduce threat ≥2 by 1) means most
  // tokens will route through addThreat naturally.
  "tideflow-engineer.current_jab": attack("tideflow-engineer", "Current Jab", 1, "Deal 4 damage. Draw 1 card.", [
    damage(4),
    drawSelf(1),
  ]),
  "tideflow-engineer.spiral_torrent": attack("tideflow-engineer", "Spiral Torrent", 2, "Deal 7 water damage.", [
    damage(7, "water"),
  ]),
  "tideflow-engineer.tidal_lance": attack("tideflow-engineer", "Tidal Lance", 3, "Deal 10 water damage. Draw 1.", [
    damage(10, "water"),
    drawSelf(1),
  ]),

  "tideflow-engineer.dampen_shield": defend("tideflow-engineer", "Dampen Shield", 1, "Gain 6 block. Reduce your threat by 2.", [
    block(6),
    reduceThreat(2),
  ]),
  "tideflow-engineer.flow_state": defend("tideflow-engineer", "Flow State", 2, "Gain 8 block. Draw 1 card.", [
    block(8),
    drawSelf(1),
  ]),
  "tideflow-engineer.runoff_ward": defend("tideflow-engineer", "Runoff Ward", 2, "Both players gain 5 block. Reduce your threat by 2.", [
    blockAll(5),
    reduceThreat(2),
  ]),

  "tideflow-engineer.reroute": support("tideflow-engineer", "Reroute", 1, "Move 3 threat from your ally to you.", [
    moveThreat("ally", "self", 3),
  ]),
  "tideflow-engineer.crosscurrent": support("tideflow-engineer", "Crosscurrent", 2, "Move 5 threat from the highest-threat player to the lowest. Draw 1.", [
    moveThreat("highest", "lowest", 5),
    drawSelf(1),
  ]),
  "tideflow-engineer.pressure_valve": support("tideflow-engineer", "Pressure Valve", 1, "Both players reduce threat by 3.", [
    reduceAllThreat(3),
  ]),
  "tideflow-engineer.confluence": support("tideflow-engineer", "Confluence", 2, "Both players draw 1. Reduce ally threat by 3.", [
    drawAll(1),
    reduceAllyThreat(3),
  ]),

  "tideflow-engineer.tide_mend": heal("tideflow-engineer", "Tide Mend", 2, "Heal the lowest-health player for 6.", [
    healLowest(6),
  ]),

  "tideflow-engineer.undertow": unique("tideflow-engineer", "Undertow", 2, "Move 4 threat from your ally to you. Gain 6 block.", [
    moveThreat("ally", "self", 4),
    block(6),
  ]),
  "tideflow-engineer.riptide_pull": unique("tideflow-engineer", "Riptide Pull", 3, "Move 6 threat from the highest-threat player to you.", [
    moveThreat("highest", "self", 6),
  ]),
  "tideflow-engineer.deluge": unique("tideflow-engineer", "Deluge", 3, "Deal 9 water damage. Both players reduce threat by 2.", [
    damage(9, "water"),
    reduceAllThreat(2),
  ]),
  "tideflow-engineer.spillway_finish": unique("tideflow-engineer", "Spillway Finish", 4, "Deal 13 water damage. Move 4 threat from yourself to your ally.", [
    damage(13, "water"),
    moveThreat("self", "ally", 4),
  ]),

  // Hydroflow Adept — canonical 4-card starter (4× Basic Attack, 4× Basic
  // Defend, 1× Flow Shift, 1× Delay Damage) inflated to 15 with extra
  // copies of the same cards. Every card you see in this deck is one of
  // the four canonical Hydroflow designs — no growth cards invented on
  // top. The starter is purposefully light on damage and heavy on
  // pressure-shifting, leaning on the Hydroflow passive (held tokens
  // soften incoming threat) and Flow Shift to seed the token economy.
  "hydroflow.basic_attack": attack("hydroflow", "Basic Attack", 1, "Deal 1 damage. Spend 1 Hydroflow token to gain +1 damage.", [
    damageWithSpend(1, "water", "hydroflow", 1),
  ]),
  "hydroflow.basic_defend": defend("hydroflow", "Basic Defend", 1, "Block 2 damage. Spend 1 Hydroflow token to gain +1 block.", [
    blockWithSpend(2, "hydroflow", 1),
  ]),
  // Flow Shift: relocates pressure from the highest-threat player to the
  // lowest. The "up to 3" amount is honored by the engine's moveThreat
  // (it caps at available threat). bonusToken grants 1 Hydroflow when
  // 3+ threat actually moved — the threshold matches the rules text.
  "hydroflow.flow_shift": support("hydroflow", "Flow Shift", 2, "Move up to 3 threat from the highest-threat player to the lowest. If 3 or more threat is moved, gain 1 Hydroflow token.", [
    moveThreatWithBonus("highest", "lowest", 3, { token: "hydroflow", threshold: 3, amount: 1 }),
  ]),
  // Delay Damage: prevents 2 damage (modeled as 2 block) and removes 2
  // threat from the highest-threat player as a reactive analogue. The
  // canonical text is "if attacked, you may remove 2 threat... once per
  // turn"; without a reactive trigger or interactive picker the closest
  // faithful reading is "always fire on play, target highest threat".
  "hydroflow.delay_damage": defend("hydroflow", "Delay Damage", 2, "Prevent 2 damage. Remove 2 threat from the highest-threat player.", [
    block(2),
    reduceThreatHighest(2),
  ]),

  // Bloomcaller — canonical Bio-Growth starter (third token archetype).
  // Pairs Hydroflow Adept's minimalist design with healing-focused
  // payoff. The engine's Bio-Growth passive (+1 to each healing while
  // held) means Mend / Greenbloom heal +1 once any token is in play.
  "bloomcaller.basic_attack": attack("bloomcaller", "Basic Attack", 1, "Deal 1 damage. Spend 1 Bio-Growth token to gain +1 damage.", [
    damageWithSpend(1, "biohack", "bio-growth", 1),
  ]),
  "bloomcaller.basic_defend": defend("bloomcaller", "Basic Defend", 1, "Block 2 damage. Spend 1 Bio-Growth token to gain +1 block.", [
    blockWithSpend(2, "bio-growth", 1),
  ]),
  "bloomcaller.mend": heal("bloomcaller", "Mend", 2, "Heal the lowest-health player for 3.", [
    healLowest(3),
  ]),
  "bloomcaller.greenbloom": support("bloomcaller", "Greenbloom", 2, "Heal both players for 2. Gain 1 Bio-Growth token.", [
    healAll(2),
    gainToken("bio-growth", 1),
  ]),

  // Stormtide Conduit — hybrid token class. Basics spend Storm Charge
  // (attack) or Hydroflow (defense). Dual Channel seeds both pools so
  // the player can repeatedly enable the engine's Conductive Surge
  // combo (held both tokens + moveThreat → bonus damage). Storm Tide
  // is the signature payoff: hits, redirects threat, and replenishes
  // both tokens in a single play.
  "stormtide-conduit.basic_attack": attack("stormtide-conduit", "Basic Attack", 1, "Deal 1 damage. Spend 1 Storm Charge token to gain +1 damage.", [
    damageWithSpend(1, "overclock", "storm-charge", 1),
  ]),
  "stormtide-conduit.basic_defend": defend("stormtide-conduit", "Basic Defend", 1, "Block 2 damage. Spend 1 Hydroflow token to gain +1 block.", [
    blockWithSpend(2, "hydroflow", 1),
  ]),
  "stormtide-conduit.dual_channel": support("stormtide-conduit", "Dual Channel", 1, "Gain 1 Storm Charge token and 1 Hydroflow token.", [
    gainToken("storm-charge", 1),
    gainToken("hydroflow", 1),
  ]),
  "stormtide-conduit.storm_tide": unique("stormtide-conduit", "Storm Tide", 2, "Deal 2 damage. Move up to 2 threat from highest to lowest. Gain 1 Storm Charge and 1 Hydroflow token.", [
    damage(2, "overclock"),
    moveThreat("highest", "lowest", 2),
    gainToken("storm-charge", 1),
    gainToken("hydroflow", 1),
  ]),

  // ─────────────────────────────────────────────────────────────────
  // Reward-only cards. These never appear in starter decks; they only
  // drop on the post-fight reward screen via `rewardOnlyPools` below.
  // Design intent: extend each starter's identity with options that
  // feel like an upgrade — more punch on the attack side, more reach
  // on the support side, plus one expensive "finish" per class.
  // ─────────────────────────────────────────────────────────────────

  // Hydroflow Adept rewards — control / pressure shifting, light damage.
  "hydroflow.tide_pulse": attack("hydroflow", "Tide Pulse", 2, "Deal 3 water damage. Spend 1 Hydroflow token to gain +2 damage.", [
    damageWithSpend(3, "water", "hydroflow", 2),
  ]),
  "hydroflow.pressure_drain": defend("hydroflow", "Pressure Drain", 1, "Gain 5 block. Remove 2 threat from the highest-threat player.", [
    block(5),
    reduceThreatHighest(2),
  ]),
  "hydroflow.deep_channel": support("hydroflow", "Deep Channel", 1, "Gain 2 Hydroflow tokens.", [
    gainToken("hydroflow", 2),
  ]),
  "hydroflow.crosswash": support("hydroflow", "Crosswash", 2, "Move up to 4 threat from the highest-threat player to the lowest. Draw 1.", [
    moveThreat("highest", "lowest", 4),
    drawSelf(1),
  ]),
  "hydroflow.undertow_grip": defend("hydroflow", "Undertow Grip", 2, "Gain 6 block. Move 3 threat from your ally to you.", [
    block(6),
    moveThreat("ally", "self", 3),
  ]),
  "hydroflow.flood_finish": unique("hydroflow", "Flood Finish", 3, "Deal 6 water damage. Move 3 threat from highest to lowest. Gain 1 Hydroflow token.", [
    damage(6, "water"),
    moveThreat("highest", "lowest", 3),
    gainToken("hydroflow", 1),
  ]),

  // Storm Forge rewards — Storm Charge burst, more reliable generation.
  "storm-forge.spark_bolt": attack("storm-forge", "Spark Bolt", 1, "Deal 3 damage. Gain 1 Storm Charge token.", [
    damage(3, "overclock"),
    gainToken("storm-charge", 1),
  ]),
  "storm-forge.lightning_step": defend("storm-forge", "Lightning Step", 1, "Gain 4 block. Reduce your threat by 3.", [
    block(4),
    reduceThreat(3),
  ]),
  "storm-forge.voltage_lance": attack("storm-forge", "Voltage Lance", 2, "Deal 5 damage. Spend 1 Storm Charge token to gain +3 damage.", [
    damageWithSpend(5, "overclock", "storm-charge", 3),
  ]),
  "storm-forge.charged_aegis": defend("storm-forge", "Charged Aegis", 2, "Gain 8 block. Gain 1 Storm Charge token.", [
    block(8),
    gainToken("storm-charge", 1),
  ]),
  "storm-forge.thunderhead_call": support("storm-forge", "Thunderhead Call", 2, "Gain 2 Storm Charge tokens. Draw 1.", [
    gainToken("storm-charge", 2),
    drawSelf(1),
  ]),
  "storm-forge.tempest_finish": unique("storm-forge", "Tempest Finish", 3, "Deal 10 damage. Gain 1 Storm Charge token.", [
    damage(10, "overclock"),
    gainToken("storm-charge", 1),
  ]),

  // Bloomcaller rewards — Bio-Growth heal/threat-sink, more attack reach.
  "bloomcaller.thorn_jab": attack("bloomcaller", "Thorn Jab", 1, "Deal 3 damage. Gain 1 Bio-Growth token.", [
    damage(3, "biohack"),
    gainToken("bio-growth", 1),
  ]),
  "bloomcaller.thornbark_guard": defend("bloomcaller", "Thornbark Guard", 1, "Gain 6 block. Gain 1 Bio-Growth token.", [
    block(6),
    gainToken("bio-growth", 1),
  ]),
  "bloomcaller.canopy_mend": heal("bloomcaller", "Canopy Mend", 2, "Heal both players for 3.", [
    healAll(3),
  ]),
  "bloomcaller.rootwoven_guard": defend("bloomcaller", "Rootwoven Guard", 2, "Both players gain 4 block.", [
    blockAll(4),
  ]),
  "bloomcaller.spore_burst": support("bloomcaller", "Spore Burst", 2, "Heal the lowest-health player for 4. Gain 1 Bio-Growth token.", [
    healLowest(4),
    gainToken("bio-growth", 1),
  ]),
  "bloomcaller.worldroot_renewal": unique("bloomcaller", "Worldroot Renewal", 3, "Heal both players for 5. Gain 1 Bio-Growth token.", [
    healAll(5),
    gainToken("bio-growth", 1),
  ]),

  // Stormtide Conduit rewards — hybrid Storm + Hydroflow.
  "stormtide-conduit.charged_jab": attack("stormtide-conduit", "Charged Jab", 1, "Deal 2 damage. Gain 1 Storm Charge token.", [
    damage(2, "overclock"),
    gainToken("storm-charge", 1),
  ]),
  "stormtide-conduit.tide_step": defend("stormtide-conduit", "Tide Step", 1, "Gain 4 block. Gain 1 Hydroflow token.", [
    block(4),
    gainToken("hydroflow", 1),
  ]),
  "stormtide-conduit.crosscurrent_strike": attack("stormtide-conduit", "Crosscurrent Strike", 2, "Deal 4 damage. Move 2 threat from you to your ally.", [
    damage(4, "overclock"),
    moveThreat("self", "ally", 2),
  ]),
  "stormtide-conduit.dual_aegis": defend("stormtide-conduit", "Dual Aegis", 2, "Gain 6 block. Gain 1 Storm Charge token.", [
    block(6),
    gainToken("storm-charge", 1),
  ]),
  "stormtide-conduit.surge_redirect": support("stormtide-conduit", "Surge Redirect", 2, "Move up to 3 threat from highest to lowest. Gain 1 Storm Charge and 1 Hydroflow token.", [
    moveThreat("highest", "lowest", 3),
    gainToken("storm-charge", 1),
    gainToken("hydroflow", 1),
  ]),
  "stormtide-conduit.thunderwave_finish": unique("stormtide-conduit", "Thunderwave Finish", 3, "Deal 7 damage. Move 2 threat from highest to lowest. Gain 1 Hydroflow token.", [
    damage(7, "overclock"),
    moveThreat("highest", "lowest", 2),
    gainToken("hydroflow", 1),
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
  // Storm Forge — preserves the canonical 10-card "Aggression fuels power"
  // shape (4×Basic Attack, 4×Basic Defend, 1×Power Strike, 1×Surge Channel)
  // and grows to 15 with 5 new singles for late-fight teeth.
  // Keyed by classDef.id (kebab-case) so createPlayer's `starterDecks[classDef.id]`
  // lookup resolves directly. camelCase aliases re-exported below.
  "storm-forge": [
    "storm-forge.basic_attack",
    "storm-forge.basic_attack",
    "storm-forge.basic_attack",
    "storm-forge.basic_attack",
    "storm-forge.basic_defend",
    "storm-forge.basic_defend",
    "storm-forge.basic_defend",
    "storm-forge.basic_defend",
    "storm-forge.power_strike",
    "storm-forge.surge_channel",
    "storm-forge.thunderclap",
    "storm-forge.arc_volley",
    "storm-forge.static_field",
    "storm-forge.charged_lance",
    "storm-forge.overload_burst",
  ],
  // Verdant Reach — heal-heavy threat sink. 3 attacks / 3 defends / 4 heals
  // / 1 support / 4 unique. The Bio-Growth passive is engine-applied so
  // amounts here are intentionally modest.
  "verdant-reach": [
    "verdant-reach.thorn_lash",
    "verdant-reach.bramble_strike",
    "verdant-reach.heartwood_smash",
    "verdant-reach.bark_brace",
    "verdant-reach.living_thicket",
    "verdant-reach.taproot_stance",
    "verdant-reach.greenheart_pulse",
    "verdant-reach.canopy_bloom",
    "verdant-reach.sap_renewal",
    "verdant-reach.world_root_mend",
    "verdant-reach.guardian_call",
    "verdant-reach.thornward",
    "verdant-reach.standing_stone",
    "verdant-reach.bloomtide",
    "verdant-reach.ancient_oath",
  ],
  // Hydroflow Adept — canonical 4-card starter scaled to 15 by repeating
  // each design. Ratios mirror the printed art (4 / 4 / 1 / 1) inflated
  // to (6 / 6 / 2 / 1) so the deck plays as designed without inventing
  // growth cards.
  hydroflow: [
    "hydroflow.basic_attack",
    "hydroflow.basic_attack",
    "hydroflow.basic_attack",
    "hydroflow.basic_attack",
    "hydroflow.basic_attack",
    "hydroflow.basic_attack",
    "hydroflow.basic_defend",
    "hydroflow.basic_defend",
    "hydroflow.basic_defend",
    "hydroflow.basic_defend",
    "hydroflow.basic_defend",
    "hydroflow.basic_defend",
    "hydroflow.flow_shift",
    "hydroflow.flow_shift",
    "hydroflow.delay_damage",
  ],
  // Bloomcaller — canonical Bio-Growth starter. 4 attack / 4 defend
  // / 4 Mend / 3 Greenbloom = 15. Bio-Growth passive (+1 healing
  // while held) lifts Mend to 4 / Greenbloom to 3 once tokens
  // accumulate, and basic attack/defend spend Bio-Growth for the
  // standard +1 damage / +1 block bump.
  bloomcaller: [
    "bloomcaller.basic_attack",
    "bloomcaller.basic_attack",
    "bloomcaller.basic_attack",
    "bloomcaller.basic_attack",
    "bloomcaller.basic_defend",
    "bloomcaller.basic_defend",
    "bloomcaller.basic_defend",
    "bloomcaller.basic_defend",
    "bloomcaller.mend",
    "bloomcaller.mend",
    "bloomcaller.mend",
    "bloomcaller.mend",
    "bloomcaller.greenbloom",
    "bloomcaller.greenbloom",
    "bloomcaller.greenbloom",
  ],
  // Stormtide Conduit — hybrid Storm + Hydroflow class. 6 attack /
  // 6 defend / 2 Dual Channel / 1 Storm Tide = 15. Basics spend the
  // opposing token type so the player constantly cycles both pools;
  // Storm Tide fires the Conductive Surge combo natively.
  "stormtide-conduit": [
    "stormtide-conduit.basic_attack",
    "stormtide-conduit.basic_attack",
    "stormtide-conduit.basic_attack",
    "stormtide-conduit.basic_attack",
    "stormtide-conduit.basic_attack",
    "stormtide-conduit.basic_attack",
    "stormtide-conduit.basic_defend",
    "stormtide-conduit.basic_defend",
    "stormtide-conduit.basic_defend",
    "stormtide-conduit.basic_defend",
    "stormtide-conduit.basic_defend",
    "stormtide-conduit.basic_defend",
    "stormtide-conduit.dual_channel",
    "stormtide-conduit.dual_channel",
    "stormtide-conduit.storm_tide",
  ],
  // Tideflow Engineer — threat redirect / soft control. Attacks lean on
  // water element so they don't double-tax on physical defense, and the
  // moveThreat suite gives the team a way to balance fixate pressure.
  "tideflow-engineer": [
    "tideflow-engineer.current_jab",
    "tideflow-engineer.spiral_torrent",
    "tideflow-engineer.tidal_lance",
    "tideflow-engineer.dampen_shield",
    "tideflow-engineer.flow_state",
    "tideflow-engineer.runoff_ward",
    "tideflow-engineer.reroute",
    "tideflow-engineer.crosscurrent",
    "tideflow-engineer.pressure_valve",
    "tideflow-engineer.confluence",
    "tideflow-engineer.tide_mend",
    "tideflow-engineer.undertow",
    "tideflow-engineer.riptide_pull",
    "tideflow-engineer.deluge",
    "tideflow-engineer.spillway_finish",
  ],
};

// camelCase aliases for the new token-themed decks. The engine looks up by
// `classDef.id` (kebab-case) but spec / tests / external callers may prefer
// camelCase property access — these reference the same array, so any future
// edits propagate.
starterDecks.stormForge = starterDecks["storm-forge"];
starterDecks.verdantReach = starterDecks["verdant-reach"];
starterDecks.tideflowEngineer = starterDecks["tideflow-engineer"];

// Reward-only card pools, keyed by classId. Cards listed here never appear
// in the starter deck — only as options on the post-fight reward screen
// via `rollRewardOptions` in src/app.js. Each card is also present in
// `cardDefinitions` (engine lookup by id), so picks plug into runDeckAdds
// without any further wiring. Classes without a pool entry fall back to
// rolling from their starter (legacy behavior).
export const rewardOnlyPools = {
  hydroflow: [
    "hydroflow.tide_pulse",
    "hydroflow.pressure_drain",
    "hydroflow.deep_channel",
    "hydroflow.crosswash",
    "hydroflow.undertow_grip",
    "hydroflow.flood_finish",
  ],
  "storm-forge": [
    "storm-forge.spark_bolt",
    "storm-forge.lightning_step",
    "storm-forge.voltage_lance",
    "storm-forge.charged_aegis",
    "storm-forge.thunderhead_call",
    "storm-forge.tempest_finish",
  ],
  bloomcaller: [
    "bloomcaller.thorn_jab",
    "bloomcaller.thornbark_guard",
    "bloomcaller.canopy_mend",
    "bloomcaller.rootwoven_guard",
    "bloomcaller.spore_burst",
    "bloomcaller.worldroot_renewal",
  ],
  "stormtide-conduit": [
    "stormtide-conduit.charged_jab",
    "stormtide-conduit.tide_step",
    "stormtide-conduit.crosscurrent_strike",
    "stormtide-conduit.dual_aegis",
    "stormtide-conduit.surge_redirect",
    "stormtide-conduit.thunderwave_finish",
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

function taunt() {
  return { type: "taunt" };
}

function gainToken(token, amount = 1) {
  return { type: "gainToken", token, amount };
}

function moveThreat(from, to, amount) {
  return { type: "moveThreat", from, to, amount };
}

// Damage with an attached "spend 1 token" rider. If the player holds
// `token`, the engine consumes one and adds `bonus` to the damage amount.
// If they don't, the action falls back to the base amount silently.
function damageWithSpend(amount, element, token, bonus) {
  const action = { type: "damage", amount, spendToken: { token, bonus } };
  if (element) action.element = element;
  return action;
}

function blockWithSpend(amount, token, bonus) {
  return { type: "block", amount, target: "self", spendToken: { token, bonus } };
}

// moveThreat that grants a bonus token when at least `bonusToken.threshold`
// threat was actually relocated. Used by Flow Shift.
function moveThreatWithBonus(from, to, amount, bonusToken) {
  return { type: "moveThreat", from, to, amount, bonusToken };
}

// reduceThreat targeting the highest-threat living player. Encoded as a
// distinct target so getPlayerTargets stays narrow — the engine resolves
// this in the reduceThreat branch.
function reduceThreatHighest(amount) {
  return { type: "reduceThreat", amount, target: "highest" };
}
