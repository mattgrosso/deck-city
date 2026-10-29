// Flat glyphs for every card family and building, drawn as SVG paths in a
// 24×24 box (docs/STS-LESSONS.md, "what we are deliberately not copying":
// no painterly art; a clean shape per thing reads from the couch).

export const ICONS = {
  road: 'M3 20 L9 4 H15 L21 20 Z M11.2 7 H12.8 L12.6 9.5 H11.4 Z M11 11.5 H13 L12.8 14.5 H11.2 Z M10.7 16.5 H13.3 L13.1 19.5 H10.9 Z',
  residential: 'M12 3 L3 11 H6 V20 H10 V14 H14 V20 H18 V11 H21 Z',
  commercial: 'M3 9 L5 4 H19 L21 9 Z M4 10 H20 V20 H14 V14 H10 V20 H4 Z',
  industrial: 'M3 20 V11 L8 14 V11 L13 14 V11 L18 14 V5 H21 V20 Z',
  park: 'M12 2 L5 11 H8 L4 17 H11 V22 H13 V17 H20 L16 11 H19 Z',
  'police-station': 'M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z M11 8 V11 H8 V13 H11 V16 H13 V13 H16 V11 H13 V8 Z',
  'sanitation-center': 'M5 6 H19 V8 H5 Z M9 3 H15 V5 H9 Z M6 9 H18 L17 21 H7 Z',
  clinic: 'M9 3 H15 V9 H21 V15 H15 V21 H9 V15 H3 V9 H9 Z',
  'fire-station': 'M12 2 C12 7 7 8 7 14 A5 5 0 0 0 17 14 C17 11 15 9 15 7 C14 9 13 9.5 13 8 C13 6 12 4 12 2 Z',
  monument: 'M10 2 H14 L15 15 H9 Z M7 16 H17 V19 H7 Z M5 20 H19 V22 H5 Z',
  civic: 'M12 3 L21 8 H3 Z M5 9 H19 V11 H5 Z M6 12 H8 V18 H6 Z M11 12 H13 V18 H11 Z M16 12 H18 V18 H16 Z M4 19 H20 V21 H4 Z',
  crime: 'M12 2 L22 20 H2 Z M11 9 H13 V14 H11 Z M11 15.5 H13 V17.5 H11 Z',
  trash: 'M8 7 L10 3 H14 L16 7 H20 V9 H4 V7 Z M6 10 H18 L17 21 H7 Z',
  pollution: 'M7 18 A4 4 0 0 1 7 10 A6 6 0 0 1 18.5 11.5 A3.5 3.5 0 0 1 18 18 Z',
  flood: 'M2 9 Q6 5 10 9 T18 9 T26 9 V12 Q22 16 18 12 T10 12 T2 12 Z M2 15 Q6 11 10 15 T18 15 T26 15 V18 Q22 22 18 18 T10 18 T2 18 Z',
  blackout: 'M13 2 L4 14 H11 L10 22 L20 9 H13 Z',
  goal: 'M6 3 H18 V5 H21 V9 A4 4 0 0 1 17 13 A5 5 0 0 1 13 16 V19 H16 V21 H8 V19 H11 V16 A5 5 0 0 1 7 13 A4 4 0 0 1 3 9 V5 H6 Z',
  coin: 'M12 2 A10 10 0 1 0 12 22 A10 10 0 1 0 12 2 Z M11 6 H13 V8 H15 V10 H11 V11 H15 V13 H13 V18 H11 V16 H9 V14 H13 V13 H9 V8 H11 Z',
  people: 'M8 4 A3 3 0 1 1 8 10 A3 3 0 1 1 8 4 Z M16 5 A2.5 2.5 0 1 1 16 10 A2.5 2.5 0 1 1 16 5 Z M2 20 C2 15 5 12 8 12 C11 12 14 15 14 20 Z M14.5 20 C14.5 16 15.5 13 16 12.5 C19 12.5 22 15 22 20 Z',
  jobs: 'M9 4 H15 V7 H21 V20 H3 V7 H9 Z M11 6 V7 H13 V6 Z',
  clock: 'M12 2 A10 10 0 1 0 12 22 A10 10 0 1 0 12 2 Z M11 6 H13 V12.5 L17 15 L16 16.6 L11 13.5 Z',
  deck: 'M4 6 H14 V20 H4 Z M8 3 H18 V17 H16 V5 H8 Z M11 2 H21 V14 H19 V4 H11 Z'
}

/** The glyph key for a card: by id when it has one, else by family. */
export function iconFor (card, family) {
  if (!card) return 'deck'
  if (ICONS[card.id]) return card.id
  if (card.type === 'goal') return 'goal'
  if (family && ICONS[family]) return family
  return 'civic'
}
