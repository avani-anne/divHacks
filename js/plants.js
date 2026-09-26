// Curated plants suited to NYC conditions. Most are native to the region; non-natives are
// flagged and included only where they're a proven city performer (e.g. green roof sedums).
//
// sun:    which light levels the plant tolerates: full (6+ h), part (3–6 h), shade (< 3 h)
// spaces: where it fits: treepit, busstop, lot, rooftop, yard, planter
// goals:  pollinators, food, cooling, stormwater, lowcare

const PLANTS = [
  // ----- Trees -----
  { name: 'Swamp white oak', latin: 'Quercus bicolor', kind: 'Tree', native: true,
    sun: ['full', 'part'], spaces: ['treepit', 'lot', 'yard'], goals: ['cooling', 'stormwater', 'lowcare'],
    note: 'Tough, long-lived shade tree that handles compacted, wet soil. Supports hundreds of insect species.' },
  { name: 'Red maple', latin: 'Acer rubrum', kind: 'Tree', native: true,
    sun: ['full', 'part'], spaces: ['treepit', 'lot', 'yard'], goals: ['cooling', 'stormwater'],
    note: 'Fast-growing, with brilliant fall color. Tolerates wet spots.' },
  { name: 'Eastern redbud', latin: 'Cercis canadensis', kind: 'Small tree', native: true,
    sun: ['full', 'part'], spaces: ['treepit', 'lot', 'yard'], goals: ['pollinators'],
    note: 'Small tree for tight spaces and under wires. Pink spring flowers feed early bees.' },
  { name: 'Serviceberry', latin: 'Amelanchier canadensis', kind: 'Small tree', native: true,
    sun: ['full', 'part'], spaces: ['treepit', 'lot', 'yard'], goals: ['pollinators', 'food'],
    note: 'White spring blooms and edible June berries. Birds love it too.' },
  { name: 'American hornbeam', latin: 'Carpinus caroliniana', kind: 'Small tree', native: true,
    sun: ['part', 'shade'], spaces: ['treepit', 'yard', 'lot'], goals: ['cooling', 'lowcare'],
    note: 'One of the few trees that thrives in the shadow of tall buildings.' },
  { name: 'Black gum', latin: 'Nyssa sylvatica', kind: 'Tree', native: true,
    sun: ['full', 'part'], spaces: ['treepit', 'lot', 'yard'], goals: ['cooling', 'stormwater', 'pollinators'],
    note: 'Handles wet and dry soil, with scarlet fall color. Flowers are a favorite of honeybees.' },
  { name: 'American linden', latin: 'Tilia americana', kind: 'Tree', native: true,
    sun: ['full', 'part'], spaces: ['treepit', 'lot'], goals: ['cooling', 'pollinators'],
    note: 'Big canopy for wide sidewalks. Fragrant summer flowers draw bees.' },

  // ----- Shrubs -----
  { name: 'Inkberry holly', latin: 'Ilex glabra', kind: 'Shrub', native: true,
    sun: ['full', 'part', 'shade'], spaces: ['lot', 'yard', 'planter', 'busstop'], goals: ['lowcare', 'stormwater'],
    note: 'Evergreen and salt-tolerant. Works in almost any light.' },
  { name: 'Arrowwood viburnum', latin: 'Viburnum dentatum', kind: 'Shrub', native: true,
    sun: ['full', 'part', 'shade'], spaces: ['lot', 'yard'], goals: ['pollinators', 'lowcare'],
    note: 'Hardy hedge shrub with flowers for bees and berries for birds.' },
  { name: 'Summersweet', latin: 'Clethra alnifolia', kind: 'Shrub', native: true,
    sun: ['part', 'shade'], spaces: ['lot', 'yard', 'planter'], goals: ['pollinators', 'stormwater'],
    note: 'Fragrant late-summer spikes that bloom in shade. Likes moist soil.' },
  { name: 'Northern bayberry', latin: 'Morella pensylvanica', kind: 'Shrub', native: true,
    sun: ['full', 'part'], spaces: ['lot', 'yard', 'rooftop'], goals: ['lowcare'],
    note: 'Wind- and salt-proof coastal shrub. Good for exposed rooftops and waterfront lots.' },

  // ----- Perennials & grasses -----
  { name: 'Butterfly weed', latin: 'Asclepias tuberosa', kind: 'Perennial', native: true,
    sun: ['full'], spaces: ['lot', 'yard', 'planter', 'rooftop', 'busstop'], goals: ['pollinators', 'lowcare'],
    note: 'Bright orange monarch host plant. Drought-tolerant once established.' },
  { name: 'Purple coneflower', latin: 'Echinacea purpurea', kind: 'Perennial', native: true,
    sun: ['full', 'part'], spaces: ['lot', 'yard', 'planter', 'treepit'], goals: ['pollinators', 'lowcare'],
    note: 'Long summer bloom for bees and butterflies. Goldfinches eat the seeds.' },
  { name: 'Black-eyed Susan', latin: 'Rudbeckia hirta', kind: 'Perennial', native: true,
    sun: ['full', 'part'], spaces: ['lot', 'yard', 'planter', 'treepit'], goals: ['pollinators', 'lowcare'],
    note: 'Cheerful and nearly indestructible. Great first plant for a new bed.' },
  { name: 'Wild bergamot', latin: 'Monarda fistulosa', kind: 'Perennial', native: true,
    sun: ['full', 'part'], spaces: ['lot', 'yard', 'planter'], goals: ['pollinators', 'food'],
    note: 'Lavender blooms that bumblebees can\'t resist. Leaves make an herbal tea.' },
  { name: 'New England aster', latin: 'Symphyotrichum novae-angliae', kind: 'Perennial', native: true,
    sun: ['full'], spaces: ['lot', 'yard'], goals: ['pollinators'],
    note: 'Late-season nectar that fuels migrating monarchs.' },
  { name: 'Little bluestem', latin: 'Schizachyrium scoparium', kind: 'Grass', native: true,
    sun: ['full'], spaces: ['lot', 'yard', 'rooftop', 'busstop', 'planter'], goals: ['lowcare', 'stormwater'],
    note: 'Drought-proof bunch grass with copper fall color. A green-roof staple.' },
  { name: 'Switchgrass', latin: 'Panicum virgatum', kind: 'Grass', native: true,
    sun: ['full', 'part'], spaces: ['lot', 'yard'], goals: ['stormwater', 'lowcare'],
    note: 'Deep roots soak up stormwater. Classic rain-garden grass.' },
  { name: 'Blue flag iris', latin: 'Iris versicolor', kind: 'Perennial', native: true,
    sun: ['full', 'part'], spaces: ['lot', 'yard'], goals: ['stormwater', 'pollinators'],
    note: 'Thrives in the wet low spot of a rain garden or bioswale.' },
  { name: 'Swamp milkweed', latin: 'Asclepias incarnata', kind: 'Perennial', native: true,
    sun: ['full', 'part'], spaces: ['lot', 'yard'], goals: ['stormwater', 'pollinators'],
    note: 'Monarch host plant that likes damp soil. Good for rain gardens.' },
  { name: 'Pennsylvania sedge', latin: 'Carex pensylvanica', kind: 'Groundcover', native: true,
    sun: ['part', 'shade'], spaces: ['treepit', 'yard', 'planter', 'busstop', 'rooftop'], goals: ['lowcare'],
    note: 'Soft, low, no-mow groundcover. Shallow roots won\'t compete with street trees.' },
  { name: 'Wild ginger', latin: 'Asarum canadense', kind: 'Groundcover', native: true,
    sun: ['shade'], spaces: ['treepit', 'yard', 'planter'], goals: ['lowcare'],
    note: 'Heart-shaped leaves that carpet deep shade.' },
  { name: 'Christmas fern', latin: 'Polystichum acrostichoides', kind: 'Fern', native: true,
    sun: ['part', 'shade'], spaces: ['yard', 'planter', 'treepit'], goals: ['lowcare'],
    note: 'Evergreen fern for north-facing yards and building shadows.' },
  { name: 'Foamflower', latin: 'Tiarella cordifolia', kind: 'Perennial', native: true,
    sun: ['part', 'shade'], spaces: ['yard', 'planter'], goals: ['pollinators'],
    note: 'Frothy white spring flowers that brighten shady corners.' },
  { name: 'Wild columbine', latin: 'Aquilegia canadensis', kind: 'Perennial', native: true,
    sun: ['part', 'shade'], spaces: ['yard', 'planter', 'treepit'], goals: ['pollinators'],
    note: 'Red and yellow spring flowers for hummingbirds. Seeds itself around.' },
  { name: 'Eastern prickly pear', latin: 'Opuntia humifusa', kind: 'Succulent', native: true,
    sun: ['full'], spaces: ['rooftop', 'busstop', 'planter'], goals: ['lowcare'],
    note: 'NYC\'s native cactus. Needs no irrigation on a shallow roof.' },
  { name: 'Sedum mix', latin: 'Sedum spp.', kind: 'Succulent', native: false,
    sun: ['full', 'part'], spaces: ['rooftop', 'busstop'], goals: ['stormwater', 'lowcare', 'cooling', 'pollinators'],
    note: 'Lightweight mats for green roofs and "bee bus stops". Soaks up rain and cools the surface.' },

  // ----- Food -----
  { name: 'Tomatoes', latin: 'Solanum lycopersicum', kind: 'Vegetable', native: false,
    sun: ['full'], spaces: ['lot', 'yard', 'rooftop', 'planter'], goals: ['food'],
    note: 'The community-garden classic. Needs 6+ hours of sun and staking.' },
  { name: 'Collards & kale', latin: 'Brassica oleracea', kind: 'Vegetable', native: false,
    sun: ['full', 'part'], spaces: ['lot', 'yard', 'rooftop', 'planter'], goals: ['food'],
    note: 'Harvest from spring into winter. Handles partial shade better than most crops.' },
  { name: 'Lettuce & salad greens', latin: 'Lactuca sativa', kind: 'Vegetable', native: false,
    sun: ['part'], spaces: ['lot', 'yard', 'rooftop', 'planter'], goals: ['food'],
    note: 'Prefers some afternoon shade in hot NYC summers. Quick to harvest.' },
  { name: 'Pole beans', latin: 'Phaseolus vulgaris', kind: 'Vegetable', native: false,
    sun: ['full'], spaces: ['lot', 'yard', 'rooftop'], goals: ['food'],
    note: 'Grows up a fence or trellis to save space, and enriches the soil.' },
  { name: 'Mint & chives', latin: 'Mentha / Allium', kind: 'Herb', native: false,
    sun: ['full', 'part', 'shade'], spaces: ['planter', 'yard', 'rooftop'], goals: ['food', 'pollinators', 'lowcare'],
    note: 'Easy herbs for containers, even in shade. Keep mint in a pot so it doesn\'t spread.' },
];

const Plants = {
  // Scores plants against the site: light and space must fit; goals raise the ranking.
  recommend({ sun, space, goals = [] }, limit = 8) {
    const spaceKey = space === 'auto' ? 'yard' : space;
    return PLANTS
      .filter(p => p.sun.includes(sun) && p.spaces.includes(spaceKey))
      .map(p => ({
        ...p,
        score: goals.filter(g => p.goals.includes(g)).length * 3 + (p.native ? 1 : 0) + (p.sun.length === 1 ? 0.5 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
};
