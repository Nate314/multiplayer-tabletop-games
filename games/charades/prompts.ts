// The prompts an actor chooses from: each can be acted silently on a webcam from the waist up.
// Imported only by the rules so guessers never get the list
export const PROMPTS: readonly string[] = [
  // everyday actions
  'brushing teeth', 'combing hair', 'shaving', 'putting on makeup', 'washing hands', 'drinking coffee', 'eating soup', 'eating spaghetti',
  'peeling a banana', 'eating corn on the cob', 'licking an ice cream cone', 'blowing bubbles', 'chewing gum', 'sneezing', 'yawning', 'hiccups',
  'tying a tie', 'putting on a hat', 'zipping a jacket', 'buttoning a shirt', 'putting in contact lenses', 'cleaning glasses', 'reading a book', 'reading a newspaper',
  'writing a letter', 'licking a stamp', 'typing on a keyboard', 'texting', 'taking a selfie', 'answering the phone', 'hanging up the phone', 'scrolling a phone',
  'washing dishes', 'drying dishes', 'ironing a shirt', 'folding laundry', 'sweeping the floor', 'dusting', 'vacuuming', 'making the bed',
  'opening a jar', 'pouring cereal', 'flipping a pancake', 'chopping onions', 'stirring a pot', 'tasting the soup', 'cracking an egg', 'kneading dough',
  'blowing out candles', 'opening a present', 'wrapping a gift', 'clapping', 'waving goodbye', 'shaking hands', 'giving a high five', 'hugging',
  'praying', 'sleeping', 'snoring', 'waking up', 'stretching', 'scratching an itch', 'biting nails', 'cracking knuckles',
  'threading a needle', 'sewing a button', 'painting a picture', 'sculpting clay', 'taking a photo', 'looking through binoculars', 'peeking through a keyhole', 'knocking on a door',
  'turning a doorknob', 'climbing a ladder', 'pulling a rope', 'pushing a heavy box', 'carrying groceries', 'lifting weights', 'doing push-ups', 'jumping rope',
  // feelings and faces
  'crying', 'laughing', 'giggling', 'being scared', 'being surprised', 'being angry', 'being bored', 'feeling cold',
  'feeling hot', 'being shy', 'being proud', 'falling in love', 'blowing a kiss', 'winking', 'rolling your eyes', 'making a wish',
  'smelling something bad', 'tasting a lemon', 'eating something spicy', 'brain freeze', 'getting a shock', 'burning your tongue', 'having a headache', 'feeling dizzy',
  // animals
  'cat', 'dog', 'monkey', 'gorilla', 'elephant', 'giraffe', 'kangaroo', 'penguin',
  'chicken', 'duck', 'owl', 'eagle', 'parrot', 'peacock', 'flamingo', 'snake',
  'frog', 'fish', 'shark', 'crab', 'lobster', 'octopus', 'jellyfish', 'turtle',
  'rabbit', 'squirrel', 'mouse', 'bat', 'bear', 'lion', 'tiger', 'wolf',
  'horse', 'cow', 'pig', 'sheep', 'goat', 'camel', 'deer', 'moose',
  'butterfly', 'bee', 'spider', 'mosquito', 'caterpillar', 'snail', 'crocodile', 'dinosaur',
  'seal', 'walrus', 'dolphin', 'hamster', 'sloth', 'koala', 'panda', 'woodpecker',
  // jobs and characters
  'doctor', 'dentist', 'nurse', 'surgeon', 'teacher', 'firefighter', 'police officer', 'chef',
  'waiter', 'barber', 'hairdresser', 'pilot', 'flight attendant', 'astronaut', 'farmer', 'fisherman',
  'painter', 'photographer', 'magician', 'clown', 'juggler', 'mime', 'singer', 'drummer',
  'guitarist', 'pianist', 'violinist', 'conductor', 'disc jockey', 'news reader', 'weather forecaster', 'mail carrier',
  'carpenter', 'plumber', 'electrician', 'mechanic', 'scientist', 'detective', 'judge', 'lifeguard',
  'cashier', 'bus driver', 'taxi driver', 'construction worker', 'librarian', 'baker', 'butcher', 'tailor',
  'pirate', 'cowboy', 'knight', 'king', 'queen', 'robot', 'zombie', 'vampire',
  'ghost', 'superhero', 'wizard', 'witch', 'ninja', 'mermaid', 'alien', 'scarecrow',
  // sports and games
  'boxing', 'tennis', 'golf', 'bowling', 'baseball', 'basketball', 'volleyball', 'table tennis',
  'swimming', 'diving', 'rowing', 'kayaking', 'surfing', 'skiing', 'snowboarding', 'ice skating',
  'archery', 'fencing', 'weightlifting', 'wrestling', 'karate', 'cycling', 'horse riding', 'fishing',
  'rock climbing', 'yoga', 'darts', 'pool', 'badminton', 'cricket', 'hockey', 'skydiving',
  'throwing a frisbee', 'shooting a free throw', 'hitting a home run', 'serving a volleyball', 'paddling a canoe', 'casting a fishing line', 'cheerleading', 'refereeing',
  'playing chess', 'playing cards', 'rolling dice', 'flying a kite', 'building a sandcastle', 'playing video games', 'doing a puzzle', 'hula hoop',
  // getting around
  'driving a car', 'riding a bike', 'riding a motorcycle', 'riding a bus', 'flying a plane', 'steering a ship', 'rowing a boat', 'riding a roller coaster',
  'parallel parking', 'changing a tire', 'pumping gas', 'hailing a taxi', 'waiting for a bus', 'pushing a stroller', 'skateboarding', 'hitchhiking',
  // music, dance and show
  'playing the piano', 'playing the drums', 'playing the guitar', 'playing the violin', 'playing the trumpet', 'playing the harp', 'conducting an orchestra', 'singing opera',
  'beatboxing', 'air guitar', 'robot dance', 'ballet', 'disco dancing', 'salsa', 'doing the twist', 'jazz hands',
  'pulling a rabbit out of a hat', 'sawing someone in half', 'walking a tightrope', 'taming a lion', 'eating fire', 'stuck in a box', 'puppet show', 'ventriloquist',
  // everyday phrases
  'raining cats and dogs', 'break a leg', 'piece of cake', 'cold feet', 'under the weather', 'hold your horses', 'butterflies in your stomach', 'on cloud nine',
  'crying over spilled milk', 'spill the beans', 'let the cat out of the bag', 'cost an arm and a leg', 'head over heels', 'in hot water', 'walking on eggshells', 'zip your lip',
  'thumbs up', 'be quiet', 'come here', 'go away', 'call me', 'time out', 'cross your fingers', 'keep your chin up',
  'running late', 'lost my keys', 'out of breath', 'sweet dreams', 'happy birthday', 'see you later', 'too loud', 'what time is it',
  // things to do with things
  'opening an umbrella', 'blowing up a balloon', 'popping a balloon', 'lighting a match', 'roasting marshmallows', 'pitching a tent', 'chopping wood', 'planting a seed',
  'watering plants', 'mowing the lawn', 'raking leaves', 'shoveling snow', 'building a snowman', 'having a snowball fight', 'hammering a nail', 'sawing wood',
  'drilling a hole', 'painting a wall', 'changing a light bulb', 'taking out the trash', 'walking the dog', 'feeding the fish', 'milking a cow', 'riding a camel',
  // the tests patch these in, so they stay distinctive
  'juggling flamingos', 'knitting a scarf', 'walking on stilts'
];
