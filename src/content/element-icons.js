// Element icon library
// ---------------------
// Inline SVG icons for the canonical Aetherfall elements. Each element gets
// a unique SHAPE plus a unique CANONICAL COLOR — the shape is the primary
// affordance so the icons remain distinguishable when rendered in grayscale
// (a baseline accessibility check for our palette).
//
// Usage:
//   getElementIcon("water")              // default canonical color
//   getElementIcon("water", { color: "currentColor" })  // inherit text color
//   listElements()                       // returns all known element ids
//
// Returned strings are inline `<svg>` markup sized at `1em x 1em` so they
// scale with the surrounding font-size. They are safe to drop directly into
// HTML template strings — no escaping required.
//
// The aliases below let callers refer to elements by either the engine id
// (`water`, `overclock`, `biohack`) OR the canonical-rules name (`hydroflow`,
// `storm-charge`, `bio-growth`). Both map to the same shape + color.

const ELEMENTS = {
  physical: {
    color: "#a8b3bd",
    // Crossed swords — silver-grey. Two thin blades meeting at the centre.
    body:
      '<path d="M4 4l16 16M20 4L4 20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
      '<circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  },
  spell: {
    color: "#b58cff",
    // Diamond — lilac. Filled rhombus.
    body:
      '<path d="M12 2.4L21.6 12 12 21.6 2.4 12z" fill="currentColor"/>',
  },
  water: {
    color: "#3ec4ff",
    // Droplet — cyan-blue. Classic teardrop silhouette.
    body:
      '<path d="M12 2.4c-3.6 4.8-6.4 8.5-6.4 12.2A6.4 6.4 0 0 0 12 21a6.4 6.4 0 0 0 6.4-6.4c0-3.7-2.8-7.4-6.4-12.2z" fill="currentColor"/>',
  },
  toxic: {
    color: "#9bd24b",
    // Hex with dot — acid-green. Hexagon outline + filled centre.
    body:
      '<path d="M12 2.4l8.3 4.8v9.6L12 21.6 3.7 16.8V7.2z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<circle cx="12" cy="12" r="2.4" fill="currentColor"/>',
  },
  overclock: {
    color: "#c084ff",
    // Lightning bolt — violet. Standard zigzag bolt.
    body:
      '<path d="M13.6 2L4.4 13.4h5.2L8.8 22l10-12.4h-5.4z" fill="currentColor"/>',
  },
  net: {
    color: "#7be0c8",
    // Mesh / web — teal. Three-line crosshatch.
    body:
      '<path d="M3 12h18M12 3v18M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  },
  biohack: {
    color: "#5cd66b",
    // Leaf — vivid green. Filled leaf with central vein.
    body:
      '<path d="M5 19c0-9 6-15 15-15-1 9-6 15-15 15z" fill="currentColor"/>' +
      '<path d="M5 19l11-11" stroke="#0f1a12" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
  },
};

// Aliases — canonical-rules names map to the same shape + color as the
// engine-id versions. The alias key returns the SAME visual.
const ALIASES = {
  hydroflow: "water",
  "storm-charge": "overclock",
  storm_charge: "overclock",
  stormcharge: "overclock",
  "bio-growth": "biohack",
  bio_growth: "biohack",
  biogrowth: "biohack",
};

/**
 * Resolve an element id (or alias) to its canonical entry.
 * @param {string} elementId
 * @returns {{ id: string, color: string, body: string } | null}
 */
function resolveElement(elementId) {
  if (!elementId || typeof elementId !== "string") {
    return null;
  }
  const key = elementId.toLowerCase();
  const canonical = ALIASES[key] ?? key;
  const entry = ELEMENTS[canonical];
  if (!entry) {
    return null;
  }
  return { id: canonical, color: entry.color, body: entry.body };
}

/**
 * Returns the canonical color for a given element id (or alias). Useful when
 * code needs the colour string but not the SVG itself (e.g. inline borders).
 * Returns null for unknown element ids.
 * @param {string} elementId
 * @returns {string | null}
 */
export function getElementColor(elementId) {
  return resolveElement(elementId)?.color ?? null;
}

/**
 * Build an inline `<svg>` string for the requested element.
 *
 * Sized at `1em x 1em` so it scales with surrounding font-size. By default
 * the icon is filled in its canonical colour. Pass `{ color: "currentColor" }`
 * (or any CSS colour token) to override and inherit from the parent text.
 *
 * Returns an empty string for unknown element ids — callers can concatenate
 * the result into a template literal without guarding.
 *
 * @param {string} elementId — engine id (`water`) or canonical alias (`hydroflow`).
 * @param {{ color?: string, title?: string }} [options]
 * @returns {string}
 */
export function getElementIcon(elementId, options = {}) {
  const entry = resolveElement(elementId);
  if (!entry) {
    return "";
  }
  const fill = options.color ?? entry.color;
  const title = options.title ?? entry.id;
  // We set color via inline style so the `currentColor` references inside
  // the SVG body resolve to the requested colour. `aria-hidden` because the
  // accompanying text label is the screen-reader-friendly source of truth.
  return (
    `<svg viewBox="0 0 24 24" width="1em" height="1em" ` +
    `class="element-icon element-icon-${entry.id}" ` +
    `style="color: ${fill}; vertical-align: -0.15em;" ` +
    `role="img" aria-label="${title}" focusable="false">` +
    entry.body +
    "</svg>"
  );
}

/**
 * @returns {string[]} every known element id (canonical names only — does not
 * include aliases like `hydroflow`).
 */
export function listElements() {
  return Object.keys(ELEMENTS);
}

/**
 * @returns {string[]} every accepted alias, including canonical ids.
 */
export function listElementAliases() {
  return [...Object.keys(ELEMENTS), ...Object.keys(ALIASES)];
}
