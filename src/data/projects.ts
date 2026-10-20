// Seed data for the Ideas & Projects board. Like hackathons.json, this is the source of
// truth for project facts (name, pitch, targets); saved board state only restores what
// the user changes on the board (stage, progress, score, next step, repo, notes).
//
// A target with a `hackathonId` is linked to that card on the Hackathons board and uses
// its live deadline. Targets for events not on the board yet carry their own `deadline`.

export type ProjectStatus = 'idea' | 'building' | 'verified' | 'submitted'

// Bump this and set `seedVersion` on a project to make its seed stage, progress, score and
// next step override what a browser saved before that version.
export const PROJECTS_SEED_VERSION = 13

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

// Zecathon allows one submission per account/team, entered in exactly one track.
const zecathonEntry: ProjectTarget = { hackathonId: null, label: 'Zecathon · Shielded Payments track (entry)', deadline: '2026-10-28T23:59:00Z' }
const zecathonNotEntered: ProjectTarget = { hackathonId: null, label: 'Zecathon (not entered)', deadline: null }
const near: ProjectTarget = { hackathonId: null, label: 'NEAR (Nov 1–14)', deadline: '2026-11-14' }

export const projectSeed: ProjectSeed[] = [
  {
    id: 'blackbox-receipts',
    name: 'Blackbox Receipts',
    pitch: 'A verifiable flight recorder for agents: signed, hash-chained receipts for every action.',
    targets: [
      // Open Agent has two cut-offs: registration closes before the submission deadline on its card.
      { hackathonId: null, label: 'Open Agent · registration', deadline: '2026-10-22T23:59:00Z' },
      { hackathonId: 'open-agent-hackathon-2026-5', label: 'Open Agent · Wildcard submission' },
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
    judgeScore: 7.5,
    scoreNote: 'Cap enforced in the circuit, plus escrow and owner-only withdraw at a85ada8; 8.0 needs a PayPal sandbox order and the re-recorded demo',
    status: 'building',
    progress: 65,
    repo: gh('leash'),
    nextStep: "PayPal sandbox demo (needs Nick's sandbox creds), then demo video and submission",
    seedVersion: 11,
  },
  {
    id: 'zec-shielded-x402',
    name: 'Shielded x402 for AI agents',
    pitch: 'x402 pay-per-request for agents, settled privately over shielded Zcash.',
    targets: [zecathonEntry],
    judgeScore: 8.5,
    scoreNote: 'Demo tx cd64980a… (block 4521440) verified fully shielded, Ironwood-only',
    status: 'verified',
    progress: 90,
    repo: gh('zec-shielded-x402'),
    nextStep: 'Cleared - Nick submits 1e232bb + v2 video by Oct 28 23:59 UTC',
    flag: 'Zecathon entry',
    seedVersion: 11,
  },
  {
    id: 'private-payroll-rail',
    name: 'Private Payroll Rail',
    pitch: 'Shielded payroll: pay a team in ZEC without exposing salaries on-chain.',
    targets: [zecathonNotEntered],
    judgeScore: 7.5,
    scoreNote: 'Live testnet payout verified: 2 employees, signed proofs pass verify-proof --lwd, 6 tamper attempts rejected',
    status: 'verified',
    progress: 90,
    repo: gh('zec-private-payroll'),
    nextStep: 'Record demo: payout, export proof, lender verifies, cross-proof rejected',
    flag: 'Not entered: portfolio piece unless organisers allow a second entry (one submission per team)',
    seedVersion: 9,
  },
  {
    id: 'sealed-bid-auction',
    name: 'Sealed-Bid Auction',
    pitch: 'Bids stay shielded until reveal, so nobody can front-run or snipe.',
    targets: [zecathonNotEntered],
    judgeScore: 6,
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'Not entered in Zecathon (one submission per team)',
    flag: 'Not entered',
    seedVersion: 9,
  },
  {
    id: 'unlinkable-swaps',
    name: 'Unlinkable swaps (wallet-side)',
    pitch: 'Wallet-side swaps that break the link between the shielded source and the swapped output.',
    targets: [zecathonNotEntered],
    judgeScore: 5,
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'Not entered in Zecathon (one submission per team)',
    flag: 'Not entered',
    seedVersion: 9,
  },
  {
    id: 'shielded-contract-sdk',
    name: 'Shielded-contract SDK',
    pitch: 'A developer SDK for building apps on top of shielded Zcash transactions.',
    targets: [zecathonNotEntered],
    judgeScore: 5,
    status: 'idea',
    progress: 0,
    repo: null,
    nextStep: 'Not entered in Zecathon (one submission per team)',
    flag: 'Not entered',
    seedVersion: 9,
  },
  {
    id: 'qday-recovery-registry',
    name: 'Q-Day Recovery for NEAR',
    pitch: 'Pre-register post-quantum recovery keys today so accounts survive Q-Day.',
    targets: [near],
    judgeScore: 7.5,
    scoreNote: 'Plan score; built Oct 20: ML-DSA-65 recovery verified on-chain on testnet (protocol 87), 6 attacks rejected on-chain, 33 sandbox tests; awaiting judge',
    status: 'building',
    progress: 85,
    repo: gh('near-qday-recovery'),
    nextStep: 'Verifier review of near-qday-recovery-build.bundle; Nick creates the GitHub repo; check the NEAR build-window rule before submitting by Nov 14 23:59 UTC',
    flag: 'NEAR entry',
    seedVersion: 12,
  },
  {
    id: 'quantum-threat-dashboard',
    name: 'Quantum Exposure on NEAR',
    pitch: 'See which accounts and keys are exposed to a quantum attacker, and how urgently.',
    targets: [near],
    judgeScore: 7.5,
    scoreNote: 'Plan score; built Oct 20: block-pinned live snapshots (mainnet: 119 of 120 sampled signers harvestable, 0 of 521 txs ML-DSA), re-run verify, 18 live tests; BTC/ETH BLOCKED on a GCP key; awaiting judge',
    status: 'building',
    progress: 80,
    repo: gh('near-quantum-threat-dashboard'),
    nextStep: 'Verifier review of near-quantum-threat-dashboard-build.bundle; Nick: GCP key for BTC/ETH, hosting OK, repo',
    flag: 'Portfolio',
    seedVersion: 13,
  },
  {
    id: 'hybrid-pq-agent-wallets',
    name: 'Hybrid PQ agent wallets',
    pitch: 'Agent wallets that sign with classical + post-quantum keys, with a migrator for existing accounts.',
    targets: [near],
    judgeScore: 7.5,
    scoreNote: 'Plan score; built Oct 20: ed25519 AND ML-DSA-65 checked on-chain, either alone rejected on testnet, on-chain agent cap hit by a real LLM agent (injected 2 NEAR refused), escalate to ML-DSA-only; 20 sandbox tests; awaiting judge',
    status: 'building',
    progress: 85,
    repo: gh('near-hybrid-pq-wallet'),
    nextStep: 'Verifier review of near-hybrid-pq-wallet-build.bundle; Nick creates the repo',
    flag: 'Portfolio',
    seedVersion: 13,
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
