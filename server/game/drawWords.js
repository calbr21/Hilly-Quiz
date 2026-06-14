// Word banks for Draw game mode, grouped by topic

const topics = {
  'Animals': [
    'Elephant', 'Penguin', 'Octopus', 'Kangaroo', 'Giraffe', 'Shark', 'Owl',
    'Dolphin', 'Tiger', 'Snail', 'Flamingo', 'Hedgehog', 'Crab', 'Bat', 'Frog'
  ],
  'Food & Drink': [
    'Pizza', 'Ice Cream', 'Sushi', 'Burger', 'Pancakes', 'Watermelon', 'Taco',
    'Donut', 'Spaghetti', 'Cupcake', 'Hot Dog', 'Popcorn', 'Sandwich', 'Cocktail'
  ],
  'Movies & TV': [
    'Superhero', 'Robot', 'Dinosaur', 'Pirate', 'Wizard', 'Alien', 'Zombie',
    'Ghost', 'Vampire', 'Astronaut', 'Ninja', 'Knight', 'Mermaid'
  ],
  'Objects': [
    'Umbrella', 'Bicycle', 'Telephone', 'Guitar', 'Rocket', 'Castle',
    'Lighthouse', 'Treasure Chest', 'Hot Air Balloon', 'Volcano', 'Clock', 'Camera'
  ],
  'Sport': [
    'Football', 'Basketball', 'Tennis Racket', 'Swimming', 'Skateboard',
    'Boxing Glove', 'Bowling Pin', 'Surfboard', 'Trophy', 'Golf Club'
  ]
};

topics['Random'] = Object.values(topics).flat();

module.exports = topics;
