// A starter game so the map isn't empty on first launch. Edit or wipe it from the "More" tab.

const N = [
  // positions
  ['standing', 'Standing', 'position'],
  ['closed-guard', 'Closed Guard', 'position'],
  ['open-guard', 'Open Guard', 'position'],
  ['half-guard', 'Half Guard', 'position'],
  ['butterfly', 'Butterfly Guard', 'position'],
  ['dlr', 'De La Riva', 'position'],
  ['open-guard-top', 'Open Guard (Top)', 'position'],
  ['side-top', 'Side Control (Top)', 'position'],
  ['side-bottom', 'Side Control (Bottom)', 'position'],
  ['mount-top', 'Mount (Top)', 'position'],
  ['mount-bottom', 'Mount (Bottom)', 'position'],
  ['back', 'Back Control', 'position'],
  ['turtle-top', 'Turtle (Top)', 'position'],
  ['kob', 'Knee on Belly', 'position'],
  ['north-south', 'North-South', 'position'],
  // takedowns
  ['double-leg', 'Double Leg', 'takedown'],
  ['single-leg', 'Single Leg', 'takedown'],
  ['guard-pull', 'Guard Pull', 'takedown'],
  // sweeps
  ['scissor', 'Scissor Sweep', 'sweep'],
  ['hip-bump', 'Hip Bump Sweep', 'sweep'],
  ['flower', 'Flower Sweep', 'sweep'],
  ['butterfly-sweep', 'Butterfly Sweep', 'sweep'],
  ['old-school', 'Old School Sweep', 'sweep'],
  ['berimbolo', 'Berimbolo', 'sweep'],
  ['tripod', 'Tripod Sweep', 'sweep'],
  // passes
  ['knee-cut', 'Knee Cut', 'pass'],
  ['toreando', 'Toreando', 'pass'],
  ['over-under', 'Over-Under', 'pass'],
  ['leg-drag', 'Leg Drag', 'pass'],
  // escapes
  ['elbow-knee', 'Elbow-Knee Escape', 'escape'],
  ['upa', 'Upa (Bridge & Roll)', 'escape'],
  ['frame-reguard', 'Frame & Reguard', 'escape'],
  // submissions
  ['armbar', 'Armbar', 'submission'],
  ['triangle', 'Triangle', 'submission'],
  ['kimura', 'Kimura', 'submission'],
  ['guillotine', 'Guillotine', 'submission'],
  ['rnc', 'Rear Naked Choke', 'submission'],
  ['bow-arrow', 'Bow & Arrow Choke', 'submission'],
  ['americana', 'Americana', 'submission'],
  ['cross-collar', 'Cross Collar Choke', 'submission'],
  ['arm-triangle', 'Arm Triangle', 'submission'],
  ['ankle-lock', 'Straight Ankle Lock', 'submission'],
];

const E = [
  ['standing', 'double-leg'], ['standing', 'single-leg'], ['standing', 'guard-pull'],
  ['double-leg', 'side-top', 'finish'], ['double-leg', 'turtle-top', 'they turtle'],
  ['single-leg', 'side-top', 'finish'], ['single-leg', 'turtle-top', 'they turtle'],
  ['guard-pull', 'closed-guard'], ['guard-pull', 'open-guard'],

  ['closed-guard', 'armbar'], ['closed-guard', 'triangle'], ['closed-guard', 'kimura'],
  ['closed-guard', 'cross-collar'], ['closed-guard', 'guillotine'],
  ['closed-guard', 'scissor'], ['closed-guard', 'hip-bump', 'they posture up'], ['closed-guard', 'flower'],
  ['closed-guard', 'open-guard', 'they stand'],
  ['hip-bump', 'mount-top'], ['hip-bump', 'kimura', 'they post the hand'], ['hip-bump', 'guillotine', 'they defend'],
  ['scissor', 'mount-top'], ['flower', 'mount-top'],
  ['triangle', 'armbar', 'they posture out'], ['armbar', 'triangle', 'they stack'],

  ['open-guard', 'butterfly'], ['open-guard', 'dlr'], ['open-guard', 'half-guard'],
  ['butterfly', 'butterfly-sweep'], ['butterfly', 'guillotine', 'they dive head in'],
  ['butterfly-sweep', 'mount-top'], ['butterfly-sweep', 'side-top'],
  ['dlr', 'berimbolo'], ['dlr', 'tripod'], ['dlr', 'ankle-lock', 'they stand tall'],
  ['berimbolo', 'back'], ['tripod', 'open-guard-top', 'come up on top'],
  ['half-guard', 'old-school'], ['half-guard', 'kimura', 'they reach over'],
  ['old-school', 'side-top'],

  ['open-guard-top', 'knee-cut'], ['open-guard-top', 'toreando'], ['open-guard-top', 'over-under'], ['open-guard-top', 'leg-drag'],
  ['knee-cut', 'side-top'], ['toreando', 'side-top'], ['toreando', 'kob'],
  ['over-under', 'side-top'], ['leg-drag', 'side-top'], ['leg-drag', 'back', 'they turn away'],

  ['side-top', 'americana'], ['side-top', 'kimura'], ['side-top', 'arm-triangle'],
  ['side-top', 'kob'], ['side-top', 'mount-top'], ['side-top', 'north-south'],
  ['kob', 'mount-top'], ['kob', 'armbar', 'they push the knee'],
  ['north-south', 'kimura'],
  ['mount-top', 'armbar'], ['mount-top', 'americana'], ['mount-top', 'arm-triangle'], ['mount-top', 'cross-collar'],
  ['mount-top', 'back', 'they turn'],
  ['back', 'rnc'], ['back', 'bow-arrow'],
  ['turtle-top', 'back', 'seatbelt + hooks'],

  ['side-bottom', 'frame-reguard'], ['frame-reguard', 'half-guard'], ['frame-reguard', 'open-guard'],
  ['mount-bottom', 'upa', 'they post high'], ['mount-bottom', 'elbow-knee'],
  ['upa', 'open-guard-top', 'land in their guard'], ['elbow-knee', 'half-guard'], ['elbow-knee', 'closed-guard'],
];

function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function makeSeed() {
  const now = Date.now();
  return {
    version: 1,
    nodes: N.map(([id, name, type], i) => ({
      id, name, type, tags: [], notes: '', clips: [], favorite: false, created: now + i,
    })),
    edges: E.map(([from, to, label = ''], i) => ({ id: 'e' + i, from, to, label })),
    journal: [
      {
        id: 'sample-lesson', kind: 'lesson', date: isoDaysAgo(2), title: 'Sample: Armbar from closed guard', coach: 'Example coach',
        body: 'Break posture first — pull them down before swinging the leg.\nPinch knees together and lift the hips; thumb up on their wrist.\nIf they stack, switch to the triangle.',
        nodeIds: ['armbar', 'closed-guard', 'triangle'], created: now - 2,
      },
      {
        id: 'sample-roll', kind: 'roll', date: isoDaysAgo(1), title: 'Sample: Open mat', partner: 'Training partner',
        worked: 'Hit the hip bump twice when they posted up.', struggled: 'Kept getting stuck under side control — framed too late.',
        nextFocus: 'Frame early from bottom side control and recover guard.', feel: 4,
        nodeIds: ['hip-bump', 'side-bottom', 'frame-reguard'], created: now - 1,
      },
    ],
    courses: [
      {
        id: 'sample-course',
        title: 'Sample: Closed Guard Fundamentals',
        instructor: 'Example course — replace with your own',
        url: '',
        notes: 'This is a placeholder to show how courses work. Paste the link to an instructional (BJJ Fanatics, Submeta, YouTube) and break it into chapters linked to your moves.',
        chapters: [
          { id: 'ch1', title: 'Breaking posture', url: '', time: '0:00', notes: '', done: true, nodeIds: ['closed-guard'] },
          { id: 'ch2', title: 'Armbar from guard', url: '', time: '12:30', notes: '', done: false, nodeIds: ['armbar', 'closed-guard'] },
          { id: 'ch3', title: 'Triangle ↔ armbar chain', url: '', time: '24:10', notes: '', done: false, nodeIds: ['triangle', 'armbar'] },
          { id: 'ch4', title: 'Hip bump / kimura / guillotine combo', url: '', time: '37:45', notes: '', done: false, nodeIds: ['hip-bump', 'kimura', 'guillotine'] },
        ],
      },
    ],
  };
}
