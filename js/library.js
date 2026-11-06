// Built-in pictogram library.
//
// Organised as a category tree: category -> subcategory -> pictogram.
// The same tree powers the helper's picture picker today, and is the base
// for the later "design your own" flow (pick a category, refine, choose).
//
// Each category has its own colour, used as the card border. Keeping the
// colour, picture and label the same every time an activity appears is what
// makes a pictogram recognisable and easy to remember.

export const CATEGORIES = [
  { id: 'morning', name: 'Morning & bathroom', color: '#3f7fd0', icon: '🪥',
    subs: [ { id: 'wake', name: 'Waking up' }, { id: 'bathroom', name: 'Bathroom' }, { id: 'dressing', name: 'Getting dressed' }, { id: 'weather', name: 'Weather clothes' } ] },
  { id: 'food', name: 'Food & drink', color: '#e8801e', icon: '🍽️',
    subs: [ { id: 'meals', name: 'Meals' }, { id: 'breakfast', name: 'Breakfast' }, { id: 'lunch', name: 'Lunch' },
            { id: 'dinner', name: 'Dinner' }, { id: 'snack', name: 'Snacks' }, { id: 'fruitveg', name: 'Fruit & vegetables' },
            { id: 'bread', name: 'Bread & toppings' }, { id: 'drinks', name: 'Drinks' } ] },
  { id: 'travel', name: 'Going places', color: '#2f9e55', icon: '🚌',
    subs: [ { id: 'transport', name: 'How we travel' }, { id: 'places', name: 'Places' } ] },
  { id: 'school', name: 'School & learning', color: '#d4a514', icon: '🏫',
    subs: [ { id: 'school', name: 'School' }, { id: 'learning', name: 'Learning' } ] },
  { id: 'play', name: 'Play & fun', color: '#d6478c', icon: '🧸',
    subs: [ { id: 'indoor', name: 'Play inside' }, { id: 'outdoor', name: 'Play outside' }, { id: 'sport', name: 'Sport & clubs' },
            { id: 'nature', name: 'Nature' }, { id: 'screens', name: 'Screens & music' } ] },
  { id: 'home', name: 'Jobs at home', color: '#8159c9', icon: '🧹',
    subs: [ { id: 'chores', name: 'Jobs' } ] },
  { id: 'health', name: 'Health & care', color: '#cf3b3b', icon: '💊',
    subs: [ { id: 'care', name: 'Care' }, { id: 'aids', name: 'Aids' }, { id: 'appointments', name: 'Appointments' } ] },
  { id: 'people', name: 'People & visits', color: '#647585', icon: '👵',
    subs: [ { id: 'family', name: 'Family' }, { id: 'others', name: 'Other people' } ] },
  { id: 'calm', name: 'Rest & feelings', color: '#1fa596', icon: '🤗',
    subs: [ { id: 'rest', name: 'Rest' }, { id: 'senses', name: 'Calm senses' }, { id: 'feelings', name: 'Feelings' } ] },
  { id: 'evening', name: 'Evening & sleep', color: '#3c4aa0', icon: '🛏️',
    subs: [ { id: 'bedtime', name: 'Bedtime' } ] },
  { id: 'other', name: 'Other', color: '#8a8a8a', icon: '⭐',
    subs: [ { id: 'other', name: 'Other' } ] },
];

// [id, category, subcategory, emoji, label, spoken phrase, keywords...]
// Keywords are matched against what the helper types or says.
const RAW = [
  // Morning & bathroom
  ['wake-up', 'morning', 'wake', '⏰', 'Wake up', 'Time to wake up', 'wake up', 'wake', 'get up', '~morning', 'alarm'],
  ['toilet', 'morning', 'bathroom', '🚽', 'Toilet', 'Go to the toilet', 'toilet', 'potty', 'bathroom', 'wee', 'pee', 'loo', 'nappy', 'diaper'],
  ['wash-hands', 'morning', 'bathroom', '🧼', 'Wash hands', 'Wash your hands', 'wash hands', '~hands', 'soap'],
  ['wash-face', 'morning', 'bathroom', '💦', 'Wash face', 'Wash your face', 'wash face', '~face'],
  ['brush-teeth', 'morning', 'bathroom', '🪥', 'Brush teeth', 'Brush your teeth', 'brush teeth', 'teeth', 'toothbrush', 'tooth'],
  ['shower', 'morning', 'bathroom', '🚿', 'Shower', 'Time for a shower', 'shower'],
  ['bath', 'morning', 'bathroom', '🛁', 'Bath', 'Time for a bath', 'bath', 'bathtime', 'bath time'],
  ['brush-hair', 'morning', 'bathroom', '💇', 'Brush hair', 'Brush your hair', 'brush hair', 'comb', '~hair'],
  ['get-dressed', 'morning', 'dressing', '👕', 'Get dressed', 'Put on your clothes', 'get dressed', 'dressed', 'clothes', '~dress'],
  ['shoes', 'morning', 'dressing', '👟', 'Shoes on', 'Put on your shoes', 'shoes', 'shoe', 'trainers', 'sneakers'],
  ['coat', 'morning', 'dressing', '🧥', 'Coat on', 'Put on your coat', 'coat', 'jacket'],
  ['glasses', 'morning', 'dressing', '👓', 'Glasses', 'Put on your glasses', 'glasses'],

  // Food & drink
  ['breakfast', 'food', 'meals', '🥣', 'Breakfast', 'Time for breakfast', 'breakfast'],
  ['lunch', 'food', 'meals', '🥪', 'Lunch', 'Time for lunch', 'lunch', 'lunchbox', 'packed lunch'],
  ['dinner', 'food', 'meals', '🍽️', 'Dinner', 'Time for dinner', 'dinner', 'supper', 'tea time', 'evening meal', '~meal', '~eat'],
  ['snack', 'food', 'snack', '🍎', 'Snack', 'Time for a snack', 'snack', 'fruit break', 'fruit'],
  ['cereal', 'food', 'breakfast', '🥣', 'Cereal', 'Eat cereal', 'cereal', 'cornflakes', 'muesli'],
  ['toast', 'food', 'breakfast', '🍞', 'Toast', 'Eat toast', 'toast'],
  ['eggs', 'food', 'breakfast', '🍳', 'Eggs', 'Eat eggs', 'egg', 'eggs'],
  ['pancakes', 'food', 'breakfast', '🥞', 'Pancakes', 'Eat pancakes', 'pancake', 'pancakes', 'waffle'],
  ['sandwich', 'food', 'lunch', '🥪', 'Sandwich', 'Eat a sandwich', 'sandwich'],
  ['soup', 'food', 'lunch', '🍲', 'Soup', 'Eat soup', 'soup'],
  ['pizza', 'food', 'dinner', '🍕', 'Pizza', 'Eat pizza', 'pizza'],
  ['pasta', 'food', 'dinner', '🍝', 'Pasta', 'Eat pasta', 'pasta', 'spaghetti', 'noodles'],
  ['rice', 'food', 'dinner', '🍚', 'Rice', 'Eat rice', 'rice'],
  ['chicken', 'food', 'dinner', '🍗', 'Chicken', 'Eat chicken', 'chicken'],
  ['fish', 'food', 'dinner', '🐟', 'Fish', 'Eat fish', 'fish'],
  ['vegetables', 'food', 'dinner', '🥦', 'Vegetables', 'Eat vegetables', 'vegetables', 'veggies', 'broccoli', 'carrots'],
  ['banana', 'food', 'snack', '🍌', 'Banana', 'Eat a banana', 'banana'],
  ['cookie', 'food', 'snack', '🍪', 'Biscuit', 'Eat a biscuit', 'cookie', 'biscuit', 'biscuits'],
  ['ice-cream', 'food', 'snack', '🍦', 'Ice cream', 'Eat ice cream', 'ice cream'],
  ['water', 'food', 'drinks', '💧', 'Water', 'Drink water', 'water', '~drink'],
  ['milk', 'food', 'drinks', '🥛', 'Milk', 'Drink milk', 'milk'],
  ['juice', 'food', 'drinks', '🧃', 'Juice', 'Drink juice', 'juice'],

  // Going places
  ['bus', 'travel', 'transport', '🚌', 'Bus', 'Go by bus', 'bus', 'school bus'],
  ['car', 'travel', 'transport', '🚗', 'Car', 'Go in the car', 'car', 'drive', 'taxi'],
  ['walk', 'travel', 'transport', '🚶', 'Walk', 'Go for a walk', 'walk', 'walking'],
  ['bike', 'travel', 'transport', '🚲', 'Bike', 'Ride your bike', 'bike', 'bicycle', 'cycle', 'scooter'],
  ['train', 'travel', 'transport', '🚆', 'Train', 'Go by train', 'train', 'metro', 'tram'],
  ['shopping', 'travel', 'places', '🛒', 'Shopping', 'Go shopping', 'shop', 'shopping', 'supermarket', 'store', 'groceries'],
  ['park', 'travel', 'places', '🌳', 'Park', 'Go to the park', 'park'],
  ['playground', 'travel', 'places', '🛝', 'Playground', 'Go to the playground', 'playground', 'swings', 'slide'],
  ['library', 'travel', 'places', '🏛️', 'Library', 'Go to the library', 'library'],
  ['zoo', 'travel', 'places', '🦁', 'Zoo', 'Go to the zoo', 'zoo', 'animals', 'farm'],
  ['beach', 'travel', 'places', '🏖️', 'Beach', 'Go to the beach', 'beach', 'sea', 'seaside'],
  ['cafe', 'travel', 'places', '☕', 'Café', 'Go to a café', 'cafe', 'café', 'restaurant', 'eat out'],
  ['museum', 'travel', 'places', '🖼️', 'Museum', 'Go to the museum', 'museum', 'gallery'],
  ['church', 'travel', 'places', '⛪', 'Church', 'Go to church', 'church', 'mosque', 'temple', 'synagogue'],
  ['trip', 'travel', 'places', '🧳', 'Trip', 'We are going on a trip', 'trip', 'holiday', 'vacation', 'travel', 'airport', 'plane'],
  ['home', 'travel', 'places', '🏠', 'Go home', 'Go home', 'go home', '~home', 'back home'],

  // School & learning
  ['school', 'school', 'school', '🏫', 'School', 'Go to school', 'school', 'class', 'classroom'],
  ['kindergarten', 'school', 'school', '🖍️', 'Kindergarten', 'Go to kindergarten', 'kindergarten', 'nursery', 'preschool', 'daycare', 'day care'],
  ['reading', 'school', 'learning', '📖', 'Reading', 'Time to read', 'read', 'reading', 'book'],
  ['writing', 'school', 'learning', '✏️', 'Writing', 'Time to write', 'write', 'writing'],
  ['homework', 'school', 'learning', '📝', 'Homework', 'Do your homework', 'homework'],
  ['maths', 'school', 'learning', '🔢', 'Maths', 'Time for maths', 'math', 'maths', 'numbers', 'counting'],
  ['music-lesson', 'school', 'learning', '🎹', 'Music lesson', 'Time for music', 'music lesson', 'piano', 'guitar', 'sing', 'singing'],
  ['pack-bag', 'school', 'school', '🎒', 'Pack bag', 'Pack your bag', 'pack bag', 'bag', 'backpack', 'schoolbag'],

  // Play & fun
  ['play', 'play', 'indoor', '🧸', 'Play', 'Time to play', '~play', 'toys', 'playtime', 'play time'],
  ['lego', 'play', 'indoor', '🧱', 'Building blocks', 'Play with blocks', 'lego', 'blocks', 'build'],
  ['drawing', 'play', 'indoor', '🎨', 'Drawing', 'Time to draw', 'draw', 'drawing', 'paint', 'painting', 'colouring', 'coloring', 'crafts'],
  ['puzzle', 'play', 'indoor', '🧩', 'Puzzle', 'Do a puzzle', 'puzzle', 'jigsaw'],
  ['games', 'play', 'indoor', '🎲', 'Board game', 'Play a game', 'game', 'games', 'board game', 'cards'],
  ['swimming', 'play', 'outdoor', '🏊', 'Swimming', 'Go swimming', 'swim', 'swimming', 'pool'],
  ['football', 'play', 'outdoor', '⚽', 'Football', 'Play football', 'football', 'soccer', 'ball'],
  ['play-outside', 'play', 'outdoor', '🌞', 'Play outside', 'Play outside', '~outside', 'garden', 'yard'],
  ['trampoline', 'play', 'outdoor', '🤸', 'Trampoline', 'Jump on the trampoline', 'trampoline', '~jump', 'gym', 'gymnastics'],
  ['horse-riding', 'play', 'outdoor', '🐴', 'Horse riding', 'Go horse riding', 'horse', '~riding', 'pony'],
  ['tablet', 'play', 'screens', '📱', 'Tablet', 'Tablet time', 'tablet', 'ipad', 'phone', 'screen time', 'computer'],
  ['tv', 'play', 'screens', '📺', 'TV', 'Watch TV', 'tv', 'television', 'cartoon', 'cartoons', '~show'],
  ['movie', 'play', 'screens', '🎬', 'Film', 'Watch a film', 'movie', 'film', 'cinema'],
  ['music', 'play', 'screens', '🎧', 'Music', 'Listen to music', 'music', '~listen', 'song', 'songs'],
  ['dance', 'play', 'indoor', '💃', 'Dance', 'Time to dance', 'dance', 'dancing', 'disco'],
  ['party', 'play', 'indoor', '🎉', 'Party', 'Go to a party', 'party', 'birthday'],

  // Jobs at home
  ['tidy-up', 'home', 'chores', '🧹', 'Tidy up', 'Tidy up your things', 'tidy', 'tidy up', '~clean', 'clean up'],
  ['set-table', 'home', 'chores', '🍴', 'Set the table', 'Help set the table', 'set the table', '~table', 'lay the table'],
  ['cook', 'home', 'chores', '🧑‍🍳', 'Cooking', 'Help with cooking', 'cook', 'cooking', 'bake', 'baking'],
  ['laundry', 'home', 'chores', '🧺', 'Laundry', 'Help with the laundry', 'laundry', 'washing'],
  ['feed-pet', 'home', 'chores', '🐕', 'Feed the pet', 'Feed the pet', 'feed', 'pet', '~dog', '~cat'],
  ['dishes', 'home', 'chores', '🫧', 'Dishes', 'Help with the dishes', 'dishes', 'dishwasher', 'wash up', 'washing up'],

  // Health & care
  ['medicine', 'health', 'care', '💊', 'Medicine', 'Time for your medicine', 'medicine', 'pill', 'pills', 'tablets', 'vitamin', 'inhaler'],
  ['doctor', 'health', 'appointments', '🩺', 'Doctor', 'Go to the doctor', 'doctor', 'gp', 'nurse', 'check up', 'checkup'],
  ['dentist', 'health', 'appointments', '🦷', 'Dentist', 'Go to the dentist', 'dentist'],
  ['hospital', 'health', 'appointments', '🏥', 'Hospital', 'Go to the hospital', 'hospital', 'clinic'],
  ['therapy', 'health', 'appointments', '🗣️', 'Therapy', 'Time for therapy', 'therapy', 'therapist', 'speech therapy', 'occupational therapy', 'ot'],
  ['physio', 'health', 'appointments', '🦵', 'Physio', 'Time for physio', 'physio', 'physiotherapy', 'exercise', 'exercises', 'stretch'],
  ['haircut', 'health', 'appointments', '✂️', 'Haircut', 'Get a haircut', 'haircut', 'hairdresser', 'barber'],

  // People & visits
  ['grandma', 'people', 'family', '👵', 'Grandma', 'See Grandma', 'grandma', 'granny', 'nana', 'grandmother', 'gran'],
  ['grandpa', 'people', 'family', '👴', 'Grandpa', 'See Grandpa', 'grandpa', 'grandad', 'granddad', 'grandfather'],
  ['mum', 'people', 'family', '👩', 'Mum', 'Time with Mum', 'mum', 'mom', 'mummy', 'mommy', 'mother'],
  ['dad', 'people', 'family', '👨', 'Dad', 'Time with Dad', 'dad', 'daddy', 'father'],
  ['family', 'people', 'family', '👨‍👩‍👧', 'Family', 'Time with family', 'family'],
  ['friend', 'people', 'others', '🧒', 'Friend', 'See a friend', 'friend', 'friends', 'playdate', 'play date'],
  ['teacher', 'people', 'others', '🧑‍🏫', 'Teacher', 'See your teacher', 'teacher'],
  ['babysitter', 'people', 'others', '🧑‍🍼', 'Babysitter', 'The babysitter is coming', 'babysitter', 'sitter', 'carer', 'helper', 'assistant'],
  ['phone-call', 'people', 'others', '📞', 'Phone call', 'Make a phone call', '~call', 'phone call', 'video call', 'facetime'],
  ['visitors', 'people', 'others', '🚪', 'Visitors', 'Someone is visiting', '~visit', 'visitor', 'visitors', 'guests'],

  // Rest & feelings
  ['quiet-time', 'calm', 'rest', '🛋️', 'Quiet time', 'Quiet time now', 'quiet', 'quiet time', 'relax', 'chill', 'calm', 'calm down', '~break'],
  ['nap', 'calm', 'rest', '😴', 'Nap', 'Time for a nap', 'nap', '~rest'],
  ['wait', 'calm', 'rest', '⏳', 'Wait', 'Now we wait', 'wait', 'waiting'],
  ['hug', 'calm', 'feelings', '🤗', 'Hug', 'Time for a hug', 'hug', 'cuddle'],
  ['happy', 'calm', 'feelings', '😊', 'Happy', 'I feel happy', 'happy'],
  ['sad', 'calm', 'feelings', '😢', 'Sad', 'I feel sad', 'sad'],

  // Evening & sleep
  ['pyjamas', 'evening', 'bedtime', '🩳', 'Pyjamas', 'Put on your pyjamas', 'pyjamas', 'pajamas', 'pjs', 'nightclothes'],
  ['story', 'evening', 'bedtime', '📚', 'Bedtime story', 'Story time', 'story', 'bedtime story', 'story time'],
  ['bed', 'evening', 'bedtime', '🛏️', 'Bed', 'Time for bed', 'bed', 'bedtime', 'go to bed', 'sleep', 'lights out', '~night'],

  // ---- More food, closer to European / Nordic home cooking ----
  ['porridge', 'food', 'breakfast', '🥣', 'Porridge', 'Eat porridge', 'porridge', 'oatmeal', 'oats', 'grød', 'havregrød'],
  ['yoghurt', 'food', 'breakfast', '🥛', 'Yoghurt', 'Eat yoghurt', 'yoghurt', 'yogurt', 'skyr', 'ymer', 'a38'],
  ['bread-roll', 'food', 'bread', '🥖', 'Bread roll', 'Eat a bread roll', 'bread roll', 'roll', 'bun', 'bolle', 'rundstykke', 'bread'],
  ['rye-bread', 'food', 'bread', '🍞', 'Rye bread', 'Eat rye bread', 'rye bread', 'rye', 'rugbrød', 'open sandwich', 'smørrebrød', 'packed lunch'],
  ['cheese', 'food', 'bread', '🧀', 'Cheese', 'Eat cheese', 'cheese', 'ost'],
  ['butter', 'food', 'bread', '🧈', 'Butter', 'Butter on bread', 'butter', 'smør'],
  ['jam', 'food', 'bread', '🍓', 'Jam', 'Jam on bread', 'jam', 'marmalade', 'syltetøj'],
  ['honey', 'food', 'bread', '🍯', 'Honey', 'Honey on bread', 'honey'],
  ['pastry', 'food', 'snack', '🥐', 'Pastry', 'Eat a pastry', 'pastry', 'croissant', 'danish', 'cinnamon bun', 'kanelsnegl', 'wienerbrød'],
  ['cake', 'food', 'snack', '🍰', 'Cake', 'Eat cake', 'cake', 'kage'],
  ['birthday-cake', 'food', 'snack', '🎂', 'Birthday cake', 'Birthday cake!', 'birthday cake', 'lagkage'],
  ['crackers', 'food', 'snack', '🍘', 'Crackers', 'Eat crackers', 'cracker', 'crackers', 'rice cake', 'knækbrød', 'crispbread'],
  ['nuts', 'food', 'snack', '🥜', 'Nuts', 'Eat nuts', 'nuts', 'peanuts', 'almonds'],
  ['potatoes', 'food', 'dinner', '🥔', 'Potatoes', 'Eat potatoes', 'potato', 'potatoes', 'kartofler', 'mash', 'mashed potatoes', 'chips', 'fries'],
  ['meatballs', 'food', 'dinner', '🧆', 'Meatballs', 'Eat meatballs', 'meatballs', 'meatball', 'frikadeller', 'kødboller', 'falafel'],
  ['sausage', 'food', 'dinner', '🌭', 'Sausage', 'Eat sausages', 'sausage', 'sausages', 'pølse', 'pølser', 'hot dog'],
  ['burger', 'food', 'dinner', '🍔', 'Burger', 'Eat a burger', 'burger', 'hamburger'],
  ['salad', 'food', 'dinner', '🥗', 'Salad', 'Eat salad', 'salad', 'salat'],
  ['curry', 'food', 'dinner', '🍛', 'Curry', 'Eat curry', 'curry', 'stew', 'gryde', 'lasagne', 'casserole'],
  ['dumplings', 'food', 'dinner', '🥟', 'Dumplings', 'Eat dumplings', 'dumplings', 'dumpling'],
  ['sushi', 'food', 'dinner', '🍣', 'Sushi', 'Eat sushi', 'sushi'],
  ['flatbread', 'food', 'dinner', '🫓', 'Flatbread', 'Eat flatbread', 'flatbread', 'wrap', 'wraps', 'pita', 'tortilla', 'pancake wrap'],
  ['fish-fingers', 'food', 'dinner', '🐠', 'Fish fingers', 'Eat fish fingers', 'fish fingers', 'fish sticks', 'fiskefrikadeller', 'salmon', 'laks'],
  ['meat', 'food', 'dinner', '🥩', 'Meat', 'Eat meat', 'meat', 'steak', 'pork', 'beef', 'roast'],
  ['apple', 'food', 'fruitveg', '🍏', 'Apple', 'Eat an apple', 'apple', 'apples', 'æble'],
  ['pear', 'food', 'fruitveg', '🍐', 'Pear', 'Eat a pear', 'pear', 'pære'],
  ['orange', 'food', 'fruitveg', '🍊', 'Orange', 'Eat an orange', 'orange', 'clementine', 'satsuma', 'mandarin'],
  ['grapes', 'food', 'fruitveg', '🍇', 'Grapes', 'Eat grapes', 'grapes', 'vindruer'],
  ['strawberries', 'food', 'fruitveg', '🍓', 'Strawberries', 'Eat strawberries', 'strawberries', 'strawberry', 'berries', 'jordbær', 'blueberries'],
  ['melon', 'food', 'fruitveg', '🍉', 'Melon', 'Eat melon', 'melon', 'watermelon'],
  ['carrot', 'food', 'fruitveg', '🥕', 'Carrot', 'Eat a carrot', 'carrot', 'carrots', 'gulerod', 'gulerødder'],
  ['cucumber', 'food', 'fruitveg', '🥒', 'Cucumber', 'Eat cucumber', 'cucumber', 'agurk'],
  ['tomato', 'food', 'fruitveg', '🍅', 'Tomato', 'Eat tomatoes', 'tomato', 'tomatoes', 'tomat'],
  ['peas', 'food', 'fruitveg', '🫛', 'Peas', 'Eat peas', 'peas', 'ærter', 'beans'],
  ['tea', 'food', 'drinks', '🍵', 'Tea', 'Drink tea', 'tea', 'te'],
  ['hot-chocolate', 'food', 'drinks', '☕', 'Hot chocolate', 'Drink hot chocolate', 'hot chocolate', 'cocoa', 'kakao'],
  ['smoothie', 'food', 'drinks', '🥤', 'Smoothie', 'Drink a smoothie', 'smoothie', 'milkshake', 'saftevand', 'squash'],
  ['lunchbox', 'food', 'lunch', '🍱', 'Lunch box', 'Eat from your lunch box', 'lunch box', 'madpakke', 'lunchbox'],

  // ---- More clothes ----
  ['rain-clothes', 'morning', 'weather', '☔', 'Rain clothes', 'Put on rain clothes', 'rain clothes', 'raincoat', 'rain', 'regntøj', 'waterproofs'],
  ['boots', 'morning', 'weather', '🥾', 'Boots', 'Put on your boots', 'boots', 'wellies', 'gummistøvler', 'rubber boots'],
  ['hat', 'morning', 'weather', '🧢', 'Hat', 'Put on your hat', 'hat', 'cap', 'hue'],
  ['mittens', 'morning', 'weather', '🧤', 'Mittens', 'Put on your mittens', 'mittens', 'gloves', 'vanter', 'handsker'],
  ['scarf', 'morning', 'weather', '🧣', 'Scarf', 'Put on your scarf', 'scarf', 'halstørklæde'],
  ['snowsuit', 'morning', 'weather', '⛄', 'Snowsuit', 'Put on your snowsuit', 'snowsuit', 'flyverdragt', 'snow', 'thermal suit', 'termotøj'],
  ['sunscreen', 'morning', 'weather', '🧴', 'Sun cream', 'Put on sun cream', 'sun cream', 'sunscreen', 'solcreme'],
  ['swimsuit', 'morning', 'dressing', '🩱', 'Swimwear', 'Put on your swimwear', 'swimsuit', 'swimwear', 'swimming trunks', 'badetøj'],

  // ---- More activities ----
  ['after-school', 'school', 'school', '🏘️', 'After-school club', 'Go to the after-school club', 'after school club', 'after-school club', 'sfo', 'fritidshjem', 'fritids', 'klub', 'youth club'],
  ['school-trip', 'school', 'school', '🚸', 'School trip', 'We go on a school trip', 'school trip', 'trip with class', 'excursion', 'udflugt'],
  ['handball', 'play', 'sport', '🤾', 'Handball', 'Play handball', 'handball', 'håndbold'],
  ['cycling', 'play', 'sport', '🚴', 'Cycling', 'Go cycling', 'cycling', 'bike ride', 'cykle', 'cykeltur'],
  ['gymnastics', 'play', 'sport', '🤸', 'Gymnastics', 'Time for gymnastics', 'gymnastics', 'gymnastik', 'pe', 'gym class'],
  ['climbing', 'play', 'sport', '🧗', 'Climbing', 'Go climbing', 'climbing', 'climb', 'klatre'],
  ['martial-arts', 'play', 'sport', '🥋', 'Karate', 'Go to karate', 'karate', 'judo', 'taekwondo', 'martial arts'],
  ['ice-skating', 'play', 'sport', '⛸️', 'Ice skating', 'Go ice skating', 'ice skating', 'skating', 'skøjter'],
  ['skiing', 'play', 'sport', '⛷️', 'Skiing', 'Go skiing', 'skiing', 'ski'],
  ['sledging', 'play', 'outdoor', '🛷', 'Sledging', 'Go sledging', 'sledge', 'sledging', 'sled', 'kælk', 'kælke'],
  ['basketball', 'play', 'sport', '🏀', 'Basketball', 'Play basketball', 'basketball'],
  ['tennis', 'play', 'sport', '🎾', 'Tennis', 'Play tennis', 'tennis', 'badminton'],
  ['bowling', 'play', 'sport', '🎳', 'Bowling', 'Go bowling', 'bowling'],
  ['scouts', 'play', 'sport', '⛺', 'Scouts', 'Go to scouts', 'scouts', 'spejder', 'camping', 'camp'],
  ['choir', 'school', 'learning', '🎤', 'Singing', 'Time to sing', 'choir', 'kor'],
  ['drums', 'school', 'learning', '🥁', 'Drums', 'Play the drums', 'drums', 'drum', 'trommer'],
  ['forest', 'play', 'nature', '🌲', 'Forest', 'Go to the forest', 'forest', 'woods', 'skov', 'forest walk', 'nature'],
  ['gardening', 'play', 'nature', '🌱', 'Gardening', 'Help in the garden', 'gardening', 'plant', 'plants', 'have'],
  ['fishing', 'play', 'nature', '🎣', 'Fishing', 'Go fishing', 'fishing', 'fiske'],
  ['boat', 'travel', 'transport', '⛴️', 'Ferry', 'Go on the ferry', 'ferry', 'boat', 'færge', 'båd'],
  ['plane', 'travel', 'transport', '✈️', 'Plane', 'Fly on a plane', 'plane', 'flight', 'fly', 'aeroplane'],
  ['sandpit', 'play', 'outdoor', '🏖️', 'Sandpit', 'Play in the sandpit', 'sandpit', 'sandbox', 'sandkasse', 'sand'],
  ['bubbles', 'play', 'indoor', '🫧', 'Bubbles', 'Blow bubbles', 'bubbles', 'sæbebobler'],
  ['playdough', 'play', 'indoor', '🟠', 'Playdough', 'Play with playdough', 'playdough', 'play doh', 'modelling clay', 'modellervoks'],
  ['sing-songs', 'play', 'screens', '🎶', 'Songs', 'Sing songs', 'songs', 'nursery rhymes', 'sange'],
  ['pet-dog', 'play', 'nature', '🐕', 'Dog walk', 'Walk the dog', 'walk the dog', 'dog walk', 'luft hunden'],
  ['library-books', 'school', 'learning', '📚', 'Books', 'Look at books', 'books', 'picture book', 'bøger'],

  // ---- More home jobs ----
  ['make-bed', 'home', 'chores', '🛏️', 'Make the bed', 'Make your bed', 'make the bed', 'make bed', 'red seng'],
  ['vacuum', 'home', 'chores', '🧹', 'Vacuum', 'Help vacuum', 'vacuum', 'hoover', 'støvsuge'],
  ['rubbish', 'home', 'chores', '🗑️', 'Rubbish out', 'Take out the rubbish', 'rubbish', 'trash', 'bin', 'garbage', 'skrald'],
  ['water-plants', 'home', 'chores', '🪴', 'Water plants', 'Water the plants', 'water the plants', 'water plants', 'vande blomster'],
  ['unpack-bag', 'home', 'chores', '🎒', 'Unpack bag', 'Unpack your bag', 'unpack', 'unpack bag', 'pak ud'],

  // ---- Health, aids & senses ----
  ['hearing-aid', 'health', 'aids', '🦻', 'Hearing aid', 'Put in your hearing aid', 'hearing aid', 'hearing aids', 'høreapparat'],
  ['wheelchair', 'health', 'aids', '♿', 'Wheelchair', 'Time for the wheelchair', 'wheelchair', 'kørestol', 'walker', 'rollator'],
  ['injection', 'health', 'care', '💉', 'Injection', 'Time for an injection', 'injection', 'vaccine', 'blood test', 'insulin', 'jab'],
  ['plaster', 'health', 'care', '🩹', 'Plaster', 'Put on a plaster', 'plaster', 'band aid', 'plaster'],
  ['eye-drops', 'health', 'care', '💧', 'Eye drops', 'Time for eye drops', 'eye drops', 'drops', 'øjendråber'],
  ['headphones', 'calm', 'senses', '🎧', 'Headphones', 'Put on your headphones', 'headphones', 'ear defenders', 'høreværn', 'ear muffs'],
  ['deep-breaths', 'calm', 'senses', '🌬️', 'Deep breaths', 'Take deep breaths', 'breathe', 'deep breaths', 'breathing'],
  ['swing', 'calm', 'senses', '🎠', 'Swing', 'Time on the swing', 'swing', 'gynge', 'hammock'],
  ['massage', 'calm', 'senses', '💆', 'Massage', 'Time for a massage', 'massage', 'weighted blanket', 'tyngdedyne'],
  ['angry', 'calm', 'feelings', '😠', 'Angry', 'I feel angry', 'angry', 'cross', 'vred', 'sur'],
  ['scared', 'calm', 'feelings', '😨', 'Scared', 'I feel scared', 'scared', 'afraid', 'bange'],
  ['tired', 'calm', 'feelings', '🥱', 'Tired', 'I feel tired', 'tired', 'træt'],
  ['hurt', 'calm', 'feelings', '🤕', 'It hurts', 'Something hurts', 'hurt', 'pain', 'ondt'],

  // ---- More people ----
  ['brother', 'people', 'family', '👦', 'Brother', 'Time with your brother', 'brother', 'bror', 'lillebror', 'storebror'],
  ['sister', 'people', 'family', '👧', 'Sister', 'Time with your sister', 'sister', 'søster', 'lillesøster', 'storesøster'],
  ['baby', 'people', 'family', '👶', 'Baby', 'Time with the baby', 'baby'],
  ['support-worker', 'people', 'others', '🧑‍🦰', 'Support worker', 'Your support worker is coming', 'support worker', 'pedagogue', 'pædagog', 'personal assistant', 'hjælper', 'støttepædagog'],
  ['respite', 'people', 'others', '🏡', 'Respite home', 'Go to the respite home', 'respite', 'aflastning', 'short break', 'respite care'],
];

// Danish words, so dictation in Danish finds the same pictograms.
const DA = {
  'wake-up': ['vågne', 'stå op', 'op'], toilet: ['toilet', 'tisse', 'ble'], 'wash-hands': ['vaske hænder', 'håndvask'],
  'wash-face': ['vaske ansigt'], 'brush-teeth': ['børste tænder', 'tandbørste', 'tænder'], shower: ['bad', 'brusebad', 'gå i bad'],
  bath: ['badekar', 'karbad'], 'brush-hair': ['rede hår', 'børste hår'], 'get-dressed': ['tøj på', 'klæde om', 'tage tøj på'],
  shoes: ['sko'], coat: ['jakke', 'frakke'], breakfast: ['morgenmad'], lunch: ['frokost'], dinner: ['aftensmad', 'middag'],
  snack: ['mellemmåltid', 'frugt'], water: ['vand'], milk: ['mælk'], juice: ['juice', 'saft'],
  bus: ['bus', 'bussen'], car: ['bil', 'bilen', 'køre'], walk: ['gå tur', 'gåtur'], bike: ['cykel', 'løbehjul'], train: ['tog', 'toget', 'metro'],
  shopping: ['handle', 'indkøb', 'supermarked'], park: ['park', 'parken'], playground: ['legeplads', 'gynger'], home: ['hjem', 'gå hjem'],
  school: ['skole', 'skolen'], kindergarten: ['børnehave', 'vuggestue', 'dagpleje'], reading: ['læse', 'lektier i læsning'],
  writing: ['skrive'], homework: ['lektier'], play: ['lege', 'legetøj'], drawing: ['tegne', 'male'], puzzle: ['puslespil'],
  games: ['spil', 'brætspil'], swimming: ['svømme', 'svømning', 'svømmehal'], football: ['fodbold'], 'play-outside': ['lege ude', 'udenfor', 'haven'],
  trampoline: ['trampolin'], tablet: ['ipad', 'tablet', 'skærm'], tv: ['fjernsyn', 'tv', 'se tv'], movie: ['film', 'biograf'],
  music: ['musik', 'høre musik'], dance: ['danse'], party: ['fest', 'fødselsdag'], 'tidy-up': ['rydde op', 'oprydning'],
  'set-table': ['dække bord'], cook: ['lave mad', 'bage'], medicine: ['medicin', 'pille'], doctor: ['læge', 'lægen'],
  dentist: ['tandlæge', 'tandlægen'], hospital: ['hospital', 'sygehus'], therapy: ['terapi', 'ergoterapi', 'talepædagog'],
  physio: ['fysioterapi', 'fys'], haircut: ['frisør', 'klippe hår'], grandma: ['mormor', 'farmor', 'bedstemor'],
  grandpa: ['morfar', 'farfar', 'bedstefar'], mum: ['mor'], dad: ['far'], family: ['familie'], friend: ['ven', 'veninde', 'legeaftale'],
  teacher: ['lærer', 'læreren'], babysitter: ['barnepige'], visitors: ['gæster', 'besøg'], 'quiet-time': ['slappe af', 'pause', 'ro'],
  nap: ['lur', 'sove middag'], wait: ['vente'], hug: ['kram'], pyjamas: ['nattøj', 'pyjamas'], story: ['godnathistorie', 'historie'],
  bed: ['seng', 'sengetid', 'sove', 'puttes', 'godnat'],
};
for (const row of RAW) if (DA[row[0]]) row.push(...DA[row[0]]);

export const BUILTIN_PICTOGRAMS = RAW.map(([id, category, subcategory, emoji, label, speech, ...keywords]) => ({
  id, category, subcategory, label, speech, keywords,
  image: { type: 'emoji', value: emoji },
  builtin: true,
}));

export const FALLBACK_IMAGE = { type: 'emoji', value: '⭐' };

export function categoryById(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
