// The setup page asks the family to photograph the things and places that come
// up every day. Each photo becomes that pictogram from then on, everywhere in
// the app, so schedules show the person's own world: their car, their table.
//
// `baseId` links an item to a library pictogram (the photo replaces it).
// Items without `baseId` become new pictograms of their own, found by `keywords`.

export const SETUP_GROUPS = [
  {
    id: 'home', title: 'At home', items: [
      { id: 'table', label: 'At the table', ask: 'the table where they eat', category: 'food', subcategory: 'meals', emoji: '🍽️',
        speech: 'Come to the table', keywords: ['table', 'dining table', 'kitchen table', 'spisebord', 'bordet', '~eat', '~meal'] },
      { id: 'bed', baseId: 'bed', ask: 'their bed' },
      { id: 'toilet', baseId: 'toilet', ask: 'the toilet' },
      { id: 'shower', baseId: 'shower', ask: 'the shower or bathroom' },
      { id: 'bath', baseId: 'bath', ask: 'the bathtub' },
      { id: 'sofa', baseId: 'quiet-time', ask: 'the sofa or their quiet place' },
      { id: 'home', baseId: 'home', ask: 'your house or front door' },
    ],
  },
  {
    id: 'food', title: 'Food & drink', items: [
      { id: 'breakfast', baseId: 'breakfast', ask: 'a typical breakfast' },
      { id: 'lunchbox', baseId: 'lunchbox', ask: 'their lunch box' },
      { id: 'dinner', baseId: 'dinner', ask: 'a typical dinner plate' },
      { id: 'snack', baseId: 'snack', ask: 'a favourite snack' },
      { id: 'water', baseId: 'water', ask: 'their own cup or water bottle' },
    ],
  },
  {
    id: 'travel', title: 'Getting around', items: [
      { id: 'car', baseId: 'car', ask: 'your car' },
      { id: 'bike', baseId: 'bike', ask: 'their bike or scooter' },
      { id: 'bus', baseId: 'bus', ask: 'the bus or the bus stop' },
      { id: 'wheelchair', baseId: 'wheelchair', ask: 'their wheelchair or walker (if they use one)' },
    ],
  },
  {
    id: 'places', title: 'Places', items: [
      { id: 'school', baseId: 'school', ask: 'their school' },
      { id: 'kindergarten', baseId: 'kindergarten', ask: 'their kindergarten or day care' },
      { id: 'after-school', baseId: 'after-school', ask: 'the after-school club' },
      { id: 'playground', baseId: 'playground', ask: 'the playground you usually go to' },
      { id: 'swimming', baseId: 'swimming', ask: 'the swimming pool' },
      { id: 'shopping', baseId: 'shopping', ask: 'the shop you usually go to' },
      { id: 'doctor', baseId: 'doctor', ask: 'the doctor or clinic' },
    ],
  },
  {
    id: 'people', title: 'People', items: [
      { id: 'mum', baseId: 'mum', ask: 'Mum' },
      { id: 'dad', baseId: 'dad', ask: 'Dad' },
      { id: 'brother', baseId: 'brother', ask: 'a brother' },
      { id: 'sister', baseId: 'sister', ask: 'a sister' },
      { id: 'grandma', baseId: 'grandma', ask: 'Grandma' },
      { id: 'grandpa', baseId: 'grandpa', ask: 'Grandpa' },
      { id: 'teacher', baseId: 'teacher', ask: 'their teacher' },
      { id: 'support-worker', baseId: 'support-worker', ask: 'their support worker or helper' },
    ],
  },
  {
    id: 'things', title: 'Things they use', items: [
      { id: 'toothbrush', baseId: 'brush-teeth', ask: 'their toothbrush' },
      { id: 'clothes', baseId: 'get-dressed', ask: 'their clothes laid out' },
      { id: 'shoes', baseId: 'shoes', ask: 'their shoes' },
      { id: 'coat', baseId: 'coat', ask: 'their jacket' },
      { id: 'bag', baseId: 'pack-bag', ask: 'their school bag' },
      { id: 'tablet', baseId: 'tablet', ask: 'their tablet or phone' },
      { id: 'toy', baseId: 'play', ask: 'a favourite toy' },
      { id: 'headphones', baseId: 'headphones', ask: 'their headphones or ear defenders' },
      { id: 'medicine', baseId: 'medicine', ask: 'their medicine' },
    ],
  },
];

export const SETUP_ITEMS = SETUP_GROUPS.flatMap(g => g.items.map(i => ({ ...i, group: g.id })));
