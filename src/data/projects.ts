// Seed data for the Ideas & Projects board. Like hackathons.json, this is the source of
// truth for project facts (name, pitch, targets); saved board state only restores what
// the user changes on the board (stage, progress, score, next step, repo, notes).
//
// A target with a `hackathonId` is linked to that card on the Hackathons board and uses
// its live deadline. Targets for events not on the board yet carry their own `deadline`.

export type ProjectStatus = 'idea' | 'building' | 'verified' | 'submitted'

// Bump this and set `seedVersion` on a project to make its seed stage, progress, score and
// next step override what a browser saved before that version.
export const PROJECTS_SEED_VERSION = 6

export type ProjectTarget = {
  hackathonId: string | null
  label: string
  deadline?: string | null
}

export type ProjectSeed = {
  id: string
  name: string
  pitch: string
  targets: ProjectTarget[]
  judgeScore: number | null
  scoreNote?: string
  status: ProjectStatus
  progress: number
  repo: string | null
  nextStep: string
  flag?: string
  /** Seed board fields win over board state saved before this PROJECTS_SEED_VERSION. */
  seedVersion?: number
}

const gh = (repo: string) => `https://github.com/nickthelegend/${repo}`

const zecathon: ProjectTarget = { hackathonId: null, label: 'Zecathon', deadline: '2026-10-28' }
const near: ProjectTarget = { hackathonId: null, label: 'NEAR (Nov 1–14)', deadline: '2026-11-14' }

export const projectSeed: ProjectSeed[] = [
  {
    id: 'blackbox-receipts',
    name: 'Blackbox Receipts',
    pitch: 'A verifiable flight recorder for agents: signed, hash-chained receipts for every action.',
    targets: [
      { hackathonId: 'open-agent-hackathon-2026-5', label: 'Open Agent · Wildcard' },
      { hackathonId: 'life-after-code-gitlab-transcend-hackathon-68', label: 'GitLab Transcend' },
    ],
    judgeScore: 8.5,
    status: 'verified',
    progress: 80,
    repo: gh('blackbox-receipts'),
    nextStep: 'Add Zetaris/Meterless keys + record demo video',
  },
  {
    id: 'tasteprobe',
    name: 'TasteProbe',
    pitch: 'GEO audits with synthetic buyer personas from Qloo’s taste graph, across ChatGPT, Perplexity and Gemini.',
    targets: [
      { hackathonId: 'qloo-agentic-hackathon-80', label: 'Qloo Agentic' },
      { hackathonId: 'nebius-x-nvidia-global-ai-hackathon-79', label: 'Nebius x NVIDIA' },
    ],
    judgeScore: null,
    status: 'verified',
    progress: 70,
    repo: gh('tasteprobe'),
    nextStep: 'Get Qloo + Nemotron API keys',
  },
  {
    id: 'leash',
    name: 'LEASH',
    pitch: 'Zero-knowledge spending mandates: agents can only pay inside a secret policy, even when prompt-injected.',
    targets: [{ hackathonId: 'paypal-ai-hackathon-137', label: 'PayPal AI' }],
    judgeScore: 7,
    scoreNote: 'Held at 7 until a PayPal sandbox order completes',
    status: 'building',
    progress: 65,
    repo: gh('leash'),
    nextStep: "PayPal sandbox demo (needs Nick's sandbox creds), then demo video and submission",
    seedVersion: 6,
  },
  {
    id: 'zec-shielded-x402',
    name: 'Shielded x402 for AI agents',
    pitch: 'x402 pay-per-request for agents, settled privately over shielded Zcash.',
    targets: [zecathon],
    judgeScore: 7.5,
    scoreNote: '8 once an agent pays a paywalled request end to end',
    status: 'building',
    progress: 60,
    repo: gh('zec-shielded-x402'),
    nextStep: 'Fund testnet agent wallet for a paid run',
    seedVersion: 5,
  },
  {
    id: 'private-payroll-rail',
    name: 'Private Payroll Rail',
    pitch: 'Shielded payroll: pay a team in ZEC without exposing salaries on-chain.',
    targets: [zecathon],
    judgeScore: 7,
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'Scope the MVP flow',
  },
  {
    id: 'sealed-bid-auction',
    name: 'Sealed-Bid Auction',
    pitch: 'Bids stay shielded until reveal, so nobody can front-run or snipe.',
    targets: [zecathon],
    judgeScore: 6,
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'Optional for Zecathon — pick commit/reveal scheme if time allows',
    flag: 'Optional',
    seedVersion: 3,
  },
  {
    id: 'unlinkable-swaps',
    name: 'Unlinkable swaps (wallet-side)',
    pitch: 'Wallet-side swaps that break the link between the shielded source and the swapped output.',
    targets: [zecathon],
    judgeScore: 5,
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'Check swap provider support',
  },
  {
    id: 'shielded-contract-sdk',
    name: 'Shielded-contract SDK',
    pitch: 'A developer SDK for building apps on top of shielded Zcash transactions.',
    targets: [zecathon],
    judgeScore: 5,
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'List the primitives devs need',
  },
  {
    id: 'qday-recovery-registry',
    name: 'Q-Day Recovery Registry client',
    pitch: 'Pre-register post-quantum recovery keys today so accounts survive Q-Day.',
    targets: [near],
    judgeScore: 7,
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'Read the registry spec',
  },
  {
    id: 'quantum-threat-dashboard',
    name: 'Quantum-threat dashboard',
    pitch: 'See which accounts and keys are exposed to a quantum attacker, and how urgently.',
    targets: [near],
    judgeScore: 7,
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'Pick the exposure metrics',
  },
  {
    id: 'hybrid-pq-agent-wallets',
    name: 'Hybrid PQ agent wallets',
    pitch: 'Agent wallets that sign with classical + post-quantum keys, with a migrator for existing accounts.',
    targets: [near],
    judgeScore: 6.5,
    scoreNote: 'Quantum-Safe Migrator merged in',
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'Choose PQ signature scheme',
    seedVersion: 3,
  },
  {
    id: 'pq-confidential-intents',
    name: 'PQ Confidential Intents',
    pitch: 'Confidential, post-quantum-safe intents for cross-chain agent actions.',
    targets: [near],
    judgeScore: 5,
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'Parked — revisit after NEAR kickoff',
    flag: 'Parked',
  },
  {
    id: 'witness',
    name: 'WITNESS',
    pitch: 'Pitch to be written once the Meta application is accepted.',
    targets: [{ hackathonId: 'meta-global-ai-developer-hackathon-44', label: 'Meta Global AI' }],
    judgeScore: 6.5,
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'Wait for Meta acceptance',
    flag: 'On hold until accepted',
  },
  {
    id: 'hackathon-hq',
    name: 'Hackathon HQ',
    pitch: 'This board: every hackathon and every project, with live deadlines.',
    targets: [],
    judgeScore: null,
    status: 'submitted',
    progress: 100,
    repo: gh('hackathon-hq'),
    nextStep: 'Keep the seed data fresh',
    flag: 'Internal',
  },
]
