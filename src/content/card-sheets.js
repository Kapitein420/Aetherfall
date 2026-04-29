import { assetUrl } from "./asset-paths.js";

const cardAsset = (path) => assetUrl(`cards/${path}`);

export const cardSheetDefinitions = {
  arian_full_cards: {
    id: "arian_full_cards",
    src: cardAsset("arian-full-card-sheet.png"),
    columns: 3,
    rows: 3,
    aspectRatio: "3 / 4",
    type: "full_card_sheet",
    cards: {
      "arian.stone_breath": { row: 1, column: 1 },
      "arian.granite_skin": { row: 1, column: 2 },
      "arian.tectonic_wait": { row: 1, column: 3 },
      "arian.stored_impact": { row: 2, column: 1 },
      "arian.mossbound_guardian": { row: 2, column: 2 },
      "arian.seismic_pressure": { row: 2, column: 3 },
      "arian.faultline_slam": { row: 3, column: 1 },
      "arian.kindly_cataclysm": { row: 3, column: 2 },
      "arian.worldbreaker_patience": { row: 3, column: 3 },
    },
  },
  geert_full_cards: {
    id: "geert_full_cards",
    src: cardAsset("geert-full-card-sheet.png"),
    columns: 3,
    rows: 3,
    aspectRatio: "3 / 4",
    type: "full_card_sheet",
    cards: {
      "geert.spark_anchor": { row: 1, column: 1 },
      "geert.repulsion_pulse": { row: 1, column: 2 },
      "geert.magnetic_drone": { row: 1, column: 3 },
      "geert.attraction_field": { row: 2, column: 1 },
      "geert.chain_capacitor": { row: 2, column: 2 },
      "geert.overclock": { row: 2, column: 3 },
      "geert.polarity_switch": { row: 3, column: 1 },
      "geert.scrap_colossus": { row: 3, column: 2 },
      "geert.perfect_chain_reaction": { row: 3, column: 3 },
    },
  },
  wouter_full_cards: {
    id: "wouter_full_cards",
    src: cardAsset("wouter-full-card-sheet.png"),
    columns: 3,
    rows: 3,
    aspectRatio: "2 / 3",
    type: "full_card_sheet",
    cards: {
      "wouter.silent_arrow": { row: 1, column: 1 },
      "wouter.veilstep": { row: 1, column: 2 },
      "wouter.loot_cache": { row: 1, column: 3 },
      "wouter.ambush_cut": { row: 2, column: 1 },
      "wouter.snare_trap": { row: 2, column: 2 },
      "wouter.relic_hunter": { row: 2, column: 3 },
      "wouter.critical_line": { row: 3, column: 1 },
      "wouter.shadow_stag": { row: 3, column: 2 },
      "wouter.perfect_heist": { row: 3, column: 3 },
    },
  },
  noah_full_cards: {
    id: "noah_full_cards",
    src: cardAsset("noah-full-card-sheet.png"),
    columns: 3,
    rows: 3,
    aspectRatio: "2 / 3",
    type: "full_card_sheet",
    cards: {
      "noah.chaos_spark": { row: 1, column: 1 },
      "noah.burning_die": { row: 1, column: 2 },
      "noah.unstable_barrier": { row: 1, column: 3 },
      "noah.reality_misprint": { row: 2, column: 1 },
      "noah.void_imp": { row: 2, column: 2 },
      "noah.wild_equation": { row: 2, column: 3 },
      "noah.backfire_blast": { row: 3, column: 1 },
      "noah.fractured_familiar": { row: 3, column: 2 },
      "noah.unwritten_catastrophe": { row: 3, column: 3 },
    },
  },
};

export const cardSheets = Object.values(cardSheetDefinitions);

export function getFullCardSprite(cardId) {
  for (const sheet of cardSheets) {
    const position = sheet.cards[cardId];
    if (position) {
      return {
        sheetId: sheet.id,
        src: sheet.src,
        columns: sheet.columns,
        rows: sheet.rows,
        aspectRatio: sheet.aspectRatio,
        ...position,
      };
    }
  }

  return null;
}

export function getCardImage(cardId) {
  const sprite = getFullCardSprite(cardId);
  if (!sprite) {
    return null;
  }

  return {
    src: cardAsset(`crops/${cardId.replace(".", "-").replaceAll("_", "-")}.png`),
    aspectRatio: sprite.aspectRatio,
  };
}
