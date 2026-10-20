// Seed data for the Ideas & Projects board. Like hackathons.json, this is the source of
// truth for project facts (name, pitch, targets); saved board state only restores what
// the user changes on the board (stage, progress, score, next step, repo, notes).
//
// A target with a `hackathonId` is linked to that card on the Hackathons board and uses
// its live deadline. Targets for events not on the board yet carry their own `deadline`.

export type ProjectStatus = 'idea' | 'building' | 'verified' | 'submitted'

// Bump this and set `seedVersion` on a project to make its seed stage, progress, score and
// next step override what a browser saved before that version.
export const PROJECTS_SEED_VERSION = 20

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
    scoreNote: 'Cap enforced in the circuit; per-policy escrow, owner-only withdraw, front-run fixed by keying policies on (owner, commitment) at 8826bcf; 96 tests; Anvil + LLM agent demo re-recorded Oct 20; 8.0 needs a PayPal sandbox order',
    status: 'building',
    progress: 75,
    repo: gh('leash'),
    nextStep: "Push leash-units-on-vf8 (5 commits on 8826bcf: CI PATH fix, units, MCP log, docs, demo); PayPal sandbox order needs Nick's sandbox creds (Nov 12)",
    seedVersion: 18,
  },
  {
    id: 'zec-shielded-x402',
    name: 'Kage (Shielded x402)',
    pitch: 'x402 pay-per-request for agents, settled privately over shielded Zcash.',
    targets: [zecathonEntry],
    judgeScore: 8.5,
    scoreNote: 'Demo tx cd64980a… (block 4521440) verified fully shielded, Ironwood-only',
    status: 'verified',
    progress: 90,
    repo: gh('zec-shielded-x402'),
    nextStep: 'Cleared - Nick submits 1e232bb + v2 video by Oct 28 23:59 UTC',
    flag: 'Zecathon entry',
    seedVersion: 19,
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
    name: 'Fuin (sealed-bid auction)',
    pitch: 'Bids stay shielded until reveal, so nobody can front-run or snipe.',
    targets: [zecathonNotEntered],
    judgeScore: 7,
    scoreNote: 'Plan score; built Oct 20: live testnet auction with 3 sealed bids and 4 rejected deposits, MaxBid Groth16 proof publishes only the winning bid, one Ironwood-only settlement checked by each viewing key, 15 tests; awaiting judge',
    status: 'building',
    progress: 85,
    repo: gh('zec-sealed-bid-auction'),
    nextStep: 'Verifier review of zec-sealed-bid-auction-build.bundle; Nick creates the repo',
    flag: 'Not entered: portfolio (Zecathon entry is Shielded x402)',
    seedVersion: 19,
  },
  {
    id: 'unlinkable-swaps',
    name: 'Lethe (unlinkable swaps)',
    pitch: 'Every swap out of Zcash gets a one-time refund address, so the public refundTo fields cannot link a wallet’s swaps.',
    targets: [zecathonNotEntered],
    judgeScore: 5.5,
    scoreNote: 'Plan score; built Oct 20: one-time refund keys (zakura-one-time-ivk 0.0.1-rc1), 3 real 1Click dry quotes with distinct refundTo, testnet refunds found only by their own keys, 14 tests; a real swap is BLOCKED on mainnet ZEC',
    status: 'building',
    progress: 75,
    repo: gh('zec-unlinkable-swaps'),
    nextStep: 'Verifier review of zec-unlinkable-swaps-build.bundle; Nick: repo, and OK + mainnet ZEC for one real swap',
    flag: 'Not entered: portfolio; real swap BLOCKED',
    seedVersion: 19,
  },
  {
    id: 'shielded-contract-sdk',
    name: 'Hanko (payment-verify SDK)',
    pitch: 'Check a shielded Zcash payment (amount, memo, confirmations, nothing transparent) with only an incoming viewing key; the same call checks null-402 proofs on Fuji.',
    targets: [zecathonNotEntered],
    judgeScore: 6.5,
    scoreNote: 'Plan score; built Oct 20: Rust crate + CLI, TS SDK, x402 paywall, MCP, dashboard; live paywall payment + 3 refused payments + payslip on testnet, 23 live tests, clean install; npm/crates publish needs Nick; awaiting judge',
    status: 'building',
    progress: 85,
    repo: gh('zec-payment-verify-sdk'),
    nextStep: 'Verifier review of zec-payment-verify-sdk-build.bundle; Nick creates the repo (and npm/crates accounts to publish)',
    flag: 'Not entered: portfolio (Zecathon entry is Shielded x402)',
    seedVersion: 19,
  },
  {
    id: 'qday-recovery-registry',
    name: 'Phylax (Q-Day recovery)',
    pitch: 'Pre-register post-quantum recovery keys today so accounts survive Q-Day.',
    targets: [near],
    judgeScore: 7.5,
    scoreNote: 'Plan score; built Oct 20: ML-DSA-65 recovery verified on-chain on testnet (protocol 87), 6 attacks rejected on-chain, 33 sandbox tests; awaiting judge',
    status: 'building',
    progress: 85,
    repo: gh('near-qday-recovery'),
    nextStep: 'Verifier review of near-qday-recovery-build.bundle; Nick creates the GitHub repo; check the NEAR build-window rule before submitting by Nov 14 23:59 UTC',
    flag: 'NEAR entry',
    seedVersion: 19,
  },
  {
    id: 'quantum-threat-dashboard',
    name: 'Argus (quantum exposure)',
    pitch: 'See which accounts and keys are exposed to a quantum attacker, and how urgently.',
    targets: [near],
    judgeScore: 7.5,
    scoreNote: 'Plan score; built Oct 20: block-pinned live snapshots (mainnet: 119 of 120 sampled signers harvestable, 0 of 521 txs ML-DSA), re-run verify, 18 live tests; BTC/ETH BLOCKED on a GCP key; awaiting judge',
    status: 'building',
    progress: 80,
    repo: gh('near-quantum-threat-dashboard'),
    nextStep: 'Verifier review of near-quantum-threat-dashboard-build.bundle; Nick: GCP key for BTC/ETH, hosting OK, repo',
    flag: 'Portfolio',
    seedVersion: 19,
  },
  {
    id: 'hybrid-pq-agent-wallets',
    name: 'Futago (hybrid PQ wallet)',
    pitch: 'Agent wallets that sign with classical + post-quantum keys, with a migrator for existing accounts.',
    targets: [near],
    judgeScore: 7.5,
    scoreNote: 'Plan score; built Oct 20: ed25519 AND ML-DSA-65 checked on-chain, either alone rejected on testnet, on-chain agent cap hit by a real LLM agent (injected 2 NEAR refused), escalate to ML-DSA-only; 20 sandbox tests; awaiting judge',
    status: 'building',
    progress: 85,
    repo: gh('near-hybrid-pq-wallet'),
    nextStep: 'Verifier review of near-hybrid-pq-wallet-build.bundle; Nick creates the repo',
    flag: 'Portfolio',
    seedVersion: 19,
  },
  {
    id: 'near-null-402',
    name: 'Nyx (near-null-402)',
    pitch: 'Agents pay per API call on NEAR with a zero-knowledge proof; the settlement never names the payer.',
    targets: [near],
    judgeScore: 7,
    scoreNote: 'Plan score; built Oct 20: Groth16 verified on-chain with alt_bn128, ML-DSA-65 merchant settlement, payer absent from settle txs, 6 attacks refused on testnet, real LLM agent via MCP, 20 sandbox tests; awaiting judge',
    status: 'building',
    progress: 85,
    repo: gh('near-null-402'),
    nextStep: 'Verifier review of near-null-402-build.bundle; Nick creates the repo; NEAR entry stays Q-Day (re-decide ~Nov 8)',
    flag: 'Portfolio',
    seedVersion: 19,
  },
  {
    id: 'zec-null-402',
    name: 'Kippu (zec-null-402)',
    pitch: 'One shielded Zcash deposit, then pay per API call with a zero-knowledge proof: no transaction per call.',
    targets: [zecathonNotEntered],
    judgeScore: 6,
    scoreNote: 'Plan score; built Oct 20: deposit of 22 notes, 20 calls paid with Groth16 proofs on testnet, refusals, gateway state anchored; 18 tests; the gateway is trusted (no contracts on Zcash)',
    status: 'building',
    progress: 85,
    repo: gh('zec-null-402'),
    nextStep: 'Verifier review of zec-null-402-build.bundle; Nick creates the repo',
    flag: 'Not entered: portfolio (Zecathon entry is Shielded x402)',
    seedVersion: 19,
  },
  {
    id: 'pq-confidential-intents',
    name: 'Yaksok (PQ intents)',
    pitch: 'Intents signed with ML-DSA-65 and sealed with ML-KEM-768, settled in shielded ZEC, with a signed, anchored decision log.',
    targets: [zecathonNotEntered],
    judgeScore: 6.5,
    scoreNote: 'Moved from NEAR to Zcash (Oct 20). Plan score; built Oct 20: 2 intents settled and 1 refunded on testnet, 6 signed rejections, log anchored in a shielded memo, 25 tests; awaiting judge',
    status: 'building',
    progress: 85,
    repo: gh('zec-pq-intents'),
    nextStep: 'Verifier review of zec-pq-intents-build.bundle; Nick creates the repo',
    flag: 'Not entered: portfolio (Zecathon entry is Shielded x402)',
    seedVersion: 19,
  },
  {
    id: 'witness',
    name: 'Hasami (Muse + SAM + SO-101)',
    pitch: 'Say what to move: Muse plans from the camera frame, SAM segments each object, depth turns the mask into a grasp, and an SO-101 arm picks and places it.',
    targets: [
      { hackathonId: null, label: 'Meta Global AI · apply by', deadline: '2026-10-26T03:59:00Z' },
      { hackathonId: null, label: 'Meta Global AI · submission (Indie)', deadline: '2026-11-05T02:00:00Z' },
    ],
    judgeScore: null,
    status: 'building',
    progress: 45,
    repo: gh('hasami'),
    nextStep: 'Nick applies by Oct 25 23:59 ET; MODEL_API_KEY (dev.meta.ai) for the Muse planner and SAM 3.1; SO-101 arm optional (sim works: 9/9 picks)',
    flag: 'Check the official rules (published before Oct 26) for a build-window clause',
    seedVersion: 20,
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
