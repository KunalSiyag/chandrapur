// The story of one Fasal Mela day in Chandrapur. Each step is data: who to talk
// to, what to gather, where to go. The director (game.js) runs it.

export const CHAPTERS = {
  welcome: 'Welcome to Chandrapur',
  garlands: 'Garlands for the Mela',
  sarson: 'Sarson ke Khet',
  aam: 'Aam ka Mausam',
  bell: 'The Bell at Dusk',
  diyas: 'Deepon ki Raat',
  moon: 'Get You the Moon',
  free: 'Shubh Fasal Mela!',
};

export const STEPS = [
  { id: 'meet-ramu', chapter: 'welcome', title: 'Meet Ramu Chaiwala', objective: 'Talk to Ramu at the station chai stall', type: 'talk', npc: 'ramu',
    dialogue: [
      ['ramu', 'Arre! A new face off the morning train? Welcome to Chandrapur, beta!'],
      ['ramu', 'You picked a lucky day — tonight is the Fasal Mela, our harvest fair. The whole valley comes down to the ghats when the moon rises.'],
      ['ramu', 'But Sharma ji at the sweet shop is in a proper panic about garlands. Go and see him in the Old Bazaar — just under the jhandiyan, east of this square.'],
      ['ramu', 'And keep your eyes on the ground — old one-rupee coins everywhere! Half of Chandrapur has holes in its pockets.'],
    ], reward: { rupees: 10 } },
  { id: 'see-sharma', chapter: 'garlands', title: 'The Sweet-Maker\'s Worry', objective: 'Find Sharma ji at his sweet shop in the Old Bazaar', type: 'talk', npc: 'sharma',
    dialogue: [
      ['sharma', 'Namaste, namaste! Ramu sent you? Bhagwan bhala kare!'],
      ['sharma', 'The Mela needs a hundred garlands and I have… zero marigolds. Zero! The jalebis will be naked!'],
      ['sharma', 'Baldev Kaka grows genda phool in his fields east of the station. Follow the farm lane past the banyan tree — the orange patches, you can\'t miss them.'],
      ['sharma', 'Bring me ten marigolds, please. I\'ll make it worth your while!'],
    ] },
  { id: 'marigolds', chapter: 'garlands', title: 'Genda Phool', objective: 'Gather marigolds in the Sarson Fields', type: 'collect', kind: 'marigold', count: 10 },
  { id: 'return-sharma', chapter: 'garlands', title: 'Back to the Bazaar', objective: 'Bring the marigolds back to Sharma ji', type: 'talk', npc: 'sharma', consume: 'marigold',
    dialogue: [
      ['sharma', 'Wah! Fresh as morning dew! My nephew will string these in no time.'],
      ['sharma', 'Here — fifty rupees for your trouble. And a box of my besan laddoos.'],
      ['sharma', 'Not for you! For Baldev Kaka at his farm. He\'s been in the fields since dawn and never remembers to eat.'],
    ], reward: { rupees: 50, item: 'laddoo' } },
  { id: 'see-baldev', chapter: 'sarson', title: 'Laddoos for Baldev Kaka', objective: 'Take the laddoos to Baldev Kaka at his farmstead', type: 'talk', npc: 'baldev', consume: 'laddoo',
    dialogue: [
      ['baldev', 'Ram Ram! Laddoos? Sharma remembered me! Sit, sit — oh, you\'re in a hurry. Young people.'],
      ['baldev', 'Look at that sarson, yellow to the horizon. Hira and Moti ploughed every row. Best bullocks in the valley.'],
      ['baldev', 'One problem: the Mela needs aam panna, and Munni\'s mangoes across the river are ripe and falling.'],
      ['baldev', 'Go back to the riverbank, walk west to the old stone footbridge, then follow the meadow path east to the orchard. Tell her Baldev sent you!'],
    ], reward: { rupees: 20 } },
  { id: 'see-munni', chapter: 'aam', title: 'Across the River', objective: 'Cross the footbridge and find Munni Didi in the Mango Orchard', type: 'talk', npc: 'munni',
    dialogue: [
      ['munni', 'Oho, a visitor! Baldev Kaka sent you? He always sends help when his knees ache.'],
      ['munni', 'The Dussehri trees are so heavy the branches touch the grass. Pick up the ripe ones under the trees — eight should do for the aam panna.'],
      ['munni', 'And if you\'re tired, the jhoola is right there. Nobody is too old for a swing in mango season.'],
    ] },
  { id: 'mangoes', chapter: 'aam', title: 'Ripe and Ready', objective: 'Pick up ripe mangoes beneath the orchard trees', type: 'collect', kind: 'mango', count: 8 },
  { id: 'return-munni', chapter: 'aam', title: 'Aam Panna for All', objective: 'Bring the mangoes to Munni Didi', type: 'talk', npc: 'munni', consume: 'mango',
    dialogue: [
      ['munni', 'Shabash! These will make the sweetest aam panna in three districts.'],
      ['munni', 'Now listen — the Mela only begins when the shrine bell rings at dusk. It\'s always rung by a guest. That\'s you!'],
      ['munni', 'Captain Bhola flies his balloon from the River Meadow up to the Fort Shoulder. From there the shrine is a short walk. Or climb through the hill village, if your legs are strong.'],
    ], reward: { rupees: 40 } },
  { id: 'reach-shrine', chapter: 'bell', title: 'Up to the Shrine', objective: 'Reach Shrine Hill — fly with Captain Bhola, or climb past the hill village', type: 'reach', district: 'shrine', target: [-35, 25.5, -76] },
  { id: 'ring-bell', chapter: 'bell', title: 'Ring the Temple Bell', objective: 'Ring the shrine bell at dusk', type: 'interact', object: 'shrine-bell', target: [-35, 25.5, -76.3] },
  { id: 'diyas', chapter: 'diyas', title: 'Light the Ghats', objective: 'Go down to the Riverside Ghats and light the diyas', type: 'diyas', count: 7, target: [25, -0.15, 50.8] },
  { id: 'moon', chapter: 'moon', title: 'Get You the Moon', objective: 'On the ghats, bring down the moon for the Mela  (press M)', type: 'moon', target: [25, -0.15, 49] },
  { id: 'free', chapter: 'free', title: 'Shubh Fasal Mela!', objective: 'Explore Chandrapur: find every rupee coin and every corner of the valley', type: 'free' },
];

export const DISCOVERY_REWARD = 10;
