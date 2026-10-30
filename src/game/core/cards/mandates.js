// MANDATES: the boss of each era. At an era's start two are offered and the
// player picks one; at the election it must be met or the run is lost
// (Matt, 2026-10-29: "if you fail the mandate, you lose... I like the idea
// of having them be a choice"). Conditions use the goal DSL
// (conditions/coreConditions.js). Numbers are tuned with `yarn selfplay`.

const m = (id, name, era, condition, blurb) => ({ id, name, era, condition, blurb })
const all = (...conditions) => ({ type: 'all', conditions })
const pop = (amount) => ({ type: 'populationAtLeast', amount })
const jobs = (amount) => ({ type: 'jobsAtLeast', amount })
const revenue = (amount) => ({ type: 'revenueAtLeast', amount })
const tagged = (tag, amount) => ({ type: 'tagCountAtLeast', tag, amount })
const employed = () => ({ type: 'employed' })
const badAtMost = (amount) => ({ type: 'statusTotalAtMost', amount })

export const MANDATES = [
  // ---- Era I: the town
  m('market-town', 'Market Town', 1, all(pop(30), tagged('commercial', 6)), 'A town that trades: shops on every corner.'),
  m('mill-town', 'Mill Town', 1, all(jobs(45), tagged('industrial', 6)), 'Smokestacks and a paycheck for everyone.'),
  m('garden-suburb', 'Garden Suburb', 1, all(pop(32), tagged('green', 4), { type: 'statusCountAtMost', tag: 'crime', amount: 3 }), 'Lawns, trees, and nobody locks their door.'),
  m('boomtown', 'Boomtown', 1, pop(42), 'Just grow. Fast.'),
  m('clean-start', 'Clean Start', 1, all(pop(30), badAtMost(5)), 'A town with nothing to hide.'),
  // ---- Era II: the city
  m('rail-city', 'Rail City', 2, all(pop(85), tagged('transit', 4)), 'Everyone gets there by train.'),
  m('industrial-powerhouse', 'Industrial Powerhouse', 2, all(jobs(120), tagged('industrial', 12)), 'The factory floor of the nation.'),
  m('culture-capital', 'Culture Capital', 2, all(pop(75), tagged('culture', 4), tagged('landmark', 2)), 'Galleries, concerts, a skyline to paint.'),
  m('full-employment', 'Full Employment', 2, all(pop(90), employed()), 'A job for every single person.'),
  m('prosperity', 'Prosperity', 2, revenue(55), 'Money, and plenty of it.'),
  // ---- Era III: the metropolis
  m('world-city', 'World City', 3, all(pop(180), tagged('landmark', 4)), 'A name the whole world knows.'),
  m('megalopolis', 'Megalopolis', 3, pop(220), 'The biggest city there has ever been.'),
  m('economic-engine', 'Economic Engine', 3, all(revenue(120), jobs(220)), 'The richest city on the map.'),
  m('green-metropolis', 'Green Metropolis', 3, all(pop(160), tagged('green', 10), { type: 'statusCountAtMost', tag: 'pollution', amount: 2 }), 'A metropolis you can breathe in.'),
  m('tourist-mecca', 'Tourist Mecca', 3, all(pop(150), tagged('landmark', 5), tagged('tourism', 6)), 'Everyone wants a photo here.')
]

export const mandatesOfEra = (era) => MANDATES.filter(x => x.era === era)
