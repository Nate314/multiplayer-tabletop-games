// The prompts an actor chooses from: each can be acted silently on a webcam from the waist up.
// Imported only by the rules so guessers never get the list
export const PROMPTS: readonly string[] = [
  // everyday actions
  'shuffling cards', 'applying sunscreen', 'drinking through a straw', 'blowing your nose', 'swatting a fly', 'counting money', 'sharpening a pencil', 'putting on earrings',
  'eating with chopsticks', 'tying a ponytail', 'blow-drying hair', 'putting on gloves', 'eating popcorn', 'making a sandwich', 'carving a turkey', 'polishing a trophy',
  'brushing teeth', 'combing hair', 'shaving', 'putting on makeup', 'washing hands', 'drinking coffee', 'eating soup', 'eating spaghetti',
  'peeling a banana', 'eating corn on the cob', 'licking an ice cream cone', 'blowing bubbles', 'chewing gum', 'sneezing', 'yawning',
  'tying a tie', 'putting on a hat', 'zipping a jacket', 'buttoning a shirt', 'putting in contact lenses', 'cleaning glasses', 'reading a book', 'reading a newspaper',
  'writing a letter', 'licking a stamp', 'typing on a keyboard', 'texting', 'taking a selfie', 'answering the phone', 'hanging up the phone', 'scrolling a phone',
  'washing dishes', 'drying dishes', 'ironing a shirt', 'folding laundry', 'sweeping the floor', 'dusting', 'vacuuming', 'making the bed',
  'opening a jar', 'pouring cereal', 'flipping a pancake', 'chopping onions', 'stirring a pot', 'tasting the soup', 'cracking an egg', 'kneading dough',
  'blowing out candles', 'opening a present', 'wrapping a gift', 'clapping', 'waving goodbye',
  'praying', 'sleeping', 'waking up', 'stretching', 'scratching an itch', 'biting nails', 'cracking knuckles',
  'threading a needle', 'sewing a button', 'painting a picture', 'sculpting clay', 'taking a photo', 'looking through binoculars', 'peeking through a keyhole', 'knocking on a door',
  'turning a doorknob', 'climbing a ladder', 'pulling a rope', 'pushing a heavy box', 'carrying groceries', 'lifting weights',
  // feelings and faces
  'crying', 'laughing', 'being scared', 'being surprised', 'being angry', 'being bored', 'feeling cold',
  'feeling hot', 'being shy', 'being proud', 'falling in love', 'blowing a kiss', 'winking', 'rolling your eyes', 'making a wish',
  'smelling something bad', 'tasting a lemon', 'eating something spicy', 'getting a shock', 'burning your tongue', 'having a headache', 'feeling dizzy',
  // animals
  'cat', 'dog', 'monkey', 'gorilla', 'elephant', 'giraffe', 'kangaroo', 'penguin',
  'chicken', 'duck', 'owl', 'eagle', 'parrot', 'peacock', 'flamingo', 'snake',
  'frog', 'fish', 'shark', 'crab', 'lobster', 'octopus', 'turtle',
  'rabbit', 'squirrel', 'mouse', 'bat', 'bear', 'lion', 'tiger', 'wolf',
  'horse', 'pig', 'sheep', 'goat', 'deer', 'moose',
  'butterfly', 'bee', 'spider', 'snail', 'crocodile', 'dinosaur',
  'seal', 'walrus', 'dolphin', 'hamster', 'sloth', 'koala', 'panda',
  // jobs and characters
  'doctor', 'dentist', 'nurse', 'surgeon', 'teacher', 'firefighter', 'police officer', 'chef',
  'waiter', 'barber', 'pilot', 'flight attendant', 'astronaut', 'farmer',
  'clown',
  'weather forecaster', 'mail carrier',
  'plumber', 'electrician', 'mechanic', 'scientist', 'detective', 'judge', 'lifeguard',
  'cashier', 'taxi driver', 'construction worker', 'librarian', 'butcher', 'tailor',
  'pirate', 'cowboy', 'knight', 'king', 'queen', 'robot', 'zombie', 'vampire',
  'ghost', 'superhero', 'wizard', 'witch', 'ninja', 'mermaid', 'alien', 'scarecrow',
  // sports and games
  'boxing', 'tennis', 'golf', 'bowling', 'baseball', 'basketball', 'volleyball', 'table tennis',
  'swimming', 'diving', 'surfing',
  'archery', 'fencing', 'karate', 'fishing',
  'rock climbing', 'yoga', 'darts', 'badminton', 'hockey',
  'throwing a frisbee', 'shooting a free throw', 'paddling a canoe', 'cheerleading',
  'playing chess', 'playing cards', 'rolling dice', 'flying a kite', 'building a sandcastle', 'playing video games', 'doing a puzzle', 'hula hoop',
  // getting around
  'driving a car', 'riding a bike', 'riding a motorcycle', 'steering a ship', 'rowing a boat', 'riding a roller coaster',
  'parallel parking', 'changing a tire', 'pumping gas', 'hailing a taxi', 'waiting for a bus', 'pushing a stroller', 'hitchhiking',
  // music, dance and show
  'playing the flute', 'playing the accordion',
  'playing the piano', 'playing the drums', 'playing the guitar', 'playing the violin', 'playing the trumpet', 'playing the harp', 'conducting an orchestra',
  'ballet', 'disco dancing', 'doing the twist', 'jazz hands',
  'pulling a rabbit out of a hat', 'stuck in a box', 'puppet show',
  // everyday phrases
  'raining cats and dogs', 'piece of cake', 'under the weather', 'hold your horses', 'butterflies in your stomach', 'on cloud nine',
  'crying over spilled milk', 'spill the beans', 'let the cat out of the bag', 'cost an arm and a leg', 'head over heels', 'in hot water', 'zip your lip',
  'thumbs up', 'be quiet', 'come here', 'go away', 'call me', 'time out', 'cross your fingers', 'keep your chin up',
  'running late', 'out of breath', 'sweet dreams', 'happy birthday', 'see you later', 'what time is it',
  // things to do with things
  'opening an umbrella', 'blowing up a balloon', 'popping a balloon', 'roasting marshmallows', 'pitching a tent', 'chopping wood', 'planting a seed',
  'watering plants', 'mowing the lawn', 'raking leaves', 'shoveling snow', 'building a snowman', 'having a snowball fight', 'hammering a nail', 'sawing wood',
  'drilling a hole', 'painting a wall', 'changing a light bulb', 'taking out the trash', 'walking the dog', 'feeding the fish', 'milking a cow', 'riding a camel',
  // the tests patch these in, so they stay distinctive
  'juggling flamingos', 'knitting a scarf', 'walking on stilts'
];
