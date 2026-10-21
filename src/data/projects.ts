// Seed data for the Ideas & Projects board. Like hackathons.json, this is the source of
// truth for project facts (name, pitch, targets); saved board state only restores what
// the user changes on the board (stage, progress, score, next step, repo, notes).
//
// A target with a `hackathonId` is linked to that card on the Hackathons board and uses
// its live deadline. Targets for events not on the board yet carry their own `deadline`.

export type ProjectStatus = 'idea' | 'building' | 'verified' | 'submitted'

// Bump this and set `seedVersion` on a project to make its seed stage, progress, score and
// next step override what a browser saved before that version.
export const PROJECTS_SEED_VERSION = 24

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
    scoreNote: 'Self-review Oct 21 (our judge agents, not the verifier): 5.5 (before fixes). blackbox-redesign 5ef0e7a on blackbox-judge-fixes 198f35b: parallel-call chain, restart/seal fixes, real upstream MCP proxy, flight-recorder landing + /recorder; 51 tests: 47 pass, 4 live skipped (no keys)',
    status: 'verified',
    progress: 80,
    repo: gh('blackbox-receipts'),
    nextStep: 'BLOCKED: Zetaris + Meterless keys, a live GitLab Duo run and a public GitLab repo (Nick). Verifier review of blackbox-redesign.bundle (5ef0e7a); no video for now (Nick, Oct 21)',
    seedVersion: 22,
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
    scoreNote: 'Self-review Oct 21 (our judge agents, not the verifier): 4.9 (before fixes). tasteprobe-judge-fixes d6829c2: Wilson + paired stats, placebo arm, place matching, keyless CLI that says Setup required; 50 tests',
    status: 'verified',
    progress: 70,
    repo: gh('tasteprobe'),
    nextStep: 'BLOCKED: QLOO_API_KEY, NEBIUS_API_KEY, OPENAI_API_KEY for a real end-to-end audit (Nick). Verifier review of tasteprobe-judge-fixes.bundle (d6829c2); Qloo + Nebius x NVIDIA Oct 30',
    seedVersion: 22,
  },
  {
    id: 'leash',
    name: 'LEASH',
    pitch: 'Zero-knowledge spending mandates: agents can only pay inside a secret policy, even when prompt-injected.',
    targets: [{ hackathonId: 'paypal-ai-hackathon-137', label: 'PayPal AI' }],
    judgeScore: 7.5,
    scoreNote: 'Verifier 7.5 at 8826bcf (front-run fixed, escrow, owner-only withdraw). Self-review Oct 21 (our judge agents, not the verifier): 6.0 for the PayPal track (before fixes). leash-redesign a5e3bbc on leash-judge-fixes 12c9342: payee bound into the allowlist leaf, rolling daily cap, Orders v2 + capture, verify-only gateway, proof-gated MCP proxy; 115 pass, 1 live skipped',
    status: 'building',
    progress: 75,
    repo: gh('leash'),
    nextStep: 'BLOCKED: one PayPal sandbox order needs PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_PAYEE_MERCHANT_ID (Nick). Verifier review of leash-redesign.bundle (a5e3bbc, 18 ahead of origin/main 8826bcf); PayPal AI Nov 12',
    seedVersion: 22,
  },
  {
    id: 'zec-shielded-x402',
    name: 'Kage (Shielded x402)',
    pitch: 'x402 pay-per-request for agents, settled privately over shielded Zcash.',
    targets: [zecathonEntry],
    judgeScore: 8.5,
    scoreNote: 'Demo tx cd64980a… (block 4521440) verified fully shielded, Ironwood-only. Self-review Oct 21 (our judge agents, not the verifier): 7.6 (before fixes); kage-redesign-v3 7995653, 75 tests',
    status: 'verified',
    progress: 90,
    repo: gh('zec-shielded-x402'),
    nextStep: 'Nick pushes main (38 commits), then submits 6eca3dc by Oct 28 23:59 UTC; decide on the ~2 min video (v2 is 44 s, pre-x402 v1) and a demo URL (GitHub Pages for landing/)',
    flag: 'Zecathon entry',
    seedVersion: 24,
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
    scoreNote: 'Plan score. Self-review Oct 21 (our judge agents, not the verifier): 6 → 7. zec-sealed-bid-auction-judge-redesign 8ee1e82: audit scans the chain and fails on deposits left out of the record, checkResult rejects a phantom winning bid, unrevealed bids declared; saleroom redesign; 27 tests',
    status: 'building',
    progress: 85,
    repo: gh('zec-sealed-bid-auction'),
    nextStep: 'Verifier review of zec-sealed-bid-auction-judge-redesign.bundle (8ee1e82); Nick creates the repo',
    flag: 'Not entered: portfolio (Zecathon entry is Shielded x402)',
    seedVersion: 22,
  },
  {
    id: 'unlinkable-swaps',
    name: 'Lethe (unlinkable swaps)',
    pitch: 'Every swap out of Zcash gets a one-time refund address, so the public refundTo fields cannot link a wallet’s swaps.',
    targets: [zecathonNotEntered],
    judgeScore: 5.5,
    scoreNote: 'Plan score. Self-review Oct 21 (our judge agents, not the verifier): 5 → 6.5. zec-unlinkable-swaps-judge-redesign 40df195: locked index book, seed-only recovery with a gap, refuses a reused recipient, claims narrowed to the refund-address link; minimal redesign; 30 tests + doc',
    status: 'building',
    progress: 75,
    repo: gh('zec-unlinkable-swaps'),
    nextStep: 'BLOCKED: a real 1Click swap needs mainnet ZEC (Nick). Verifier review of zec-unlinkable-swaps-judge-redesign.bundle (40df195); Nick creates the repo',
    flag: 'Not entered: portfolio; real swap BLOCKED',
    seedVersion: 22,
  },
  {
    id: 'shielded-contract-sdk',
    name: 'Hanko (payment-verify SDK)',
    pitch: 'Check a shielded Zcash payment (amount, memo, confirmations, nothing transparent) with only an incoming viewing key; the same call checks null-402 proofs on Fuji.',
    targets: [zecathonNotEntered],
    judgeScore: 6.5,
    scoreNote: 'Plan score. Self-review Oct 21 (our judge agents, not the verifier): 6 → 7. zec-payment-verify-sdk-judge-redesign 27340b4: paywall claims memo/txid before the check (race test), capped challenges, null-402 check without payTo + amount is UNBOUND, CI; API-reference redesign; 27 tests + 1 doc example',
    status: 'building',
    progress: 85,
    repo: gh('zec-payment-verify-sdk'),
    nextStep: 'BLOCKED: npm + crates.io accounts to publish (Nick). Verifier review of zec-payment-verify-sdk-judge-redesign.bundle (27340b4); Nick creates the repo',
    flag: 'Not entered: portfolio (Zecathon entry is Shielded x402)',
    seedVersion: 22,
  },
  {
    id: 'qday-recovery-registry',
    name: 'Phylax (Q-Day recovery)',
    pitch: 'Pre-register post-quantum recovery keys today so accounts survive Q-Day.',
    targets: [near],
    judgeScore: 7.5,
    scoreNote: 'Plan score. Self-review Oct 21 (our judge agents, not the verifier): 7.3 at 783c83c (before fixes). Built Oct 20: ML-DSA-65 recovery verified on testnet, 6 attacks rejected on-chain, 33 sandbox tests; every commit predates the NEAR window',
    status: 'building',
    progress: 85,
    repo: gh('near-qday-recovery'),
    nextStep: 'No code until Nov 1 00:00 UTC; then build in-window per grokbot/specs/phylax-window-plan.md (tag pre-hackathon-v0 at 783c83c, function-call-key takeover fix first); Nick creates the repo; submit by Nov 14 23:59 UTC',
    flag: 'NEAR entry',
    seedVersion: 22,
  },
  {
    id: 'quantum-threat-dashboard',
    name: 'Argus (quantum exposure)',
    pitch: 'See which accounts and keys are exposed to a quantum attacker, and how urgently.',
    targets: [near],
    judgeScore: 7.5,
    scoreNote: 'Plan score. Self-review Oct 21 (our judge agents, not the verifier): 6.5 → 7.5. near-quantum-threat-dashboard-judge-redesign 186f8d6: sealed metrics (edited ones rejected, 422), final-block exposure reads, contract verdict, rate limit, CI; explorer redesign; 26 live tests',
    status: 'building',
    progress: 80,
    repo: gh('near-quantum-threat-dashboard'),
    nextStep: 'BLOCKED: BTC/ETH need GCP BigQuery creds (GOOGLE_APPLICATION_CREDENTIALS) (Nick). Verifier review of near-quantum-threat-dashboard-judge-redesign.bundle (186f8d6); Nick: hosting OK, repo',
    flag: 'Portfolio',
    seedVersion: 22,
  },
  {
    id: 'hybrid-pq-agent-wallets',
    name: 'Futago (hybrid PQ wallet)',
    pitch: 'Agent wallets that sign with classical + post-quantum keys, with a migrator for existing accounts.',
    targets: [near],
    judgeScore: 7.5,
    scoreNote: 'Plan score. Self-review Oct 21 (our judge agents, not the verifier): 6 → 7. near-hybrid-pq-wallet-judge-redesign 4577be7: v2 contract locked at deploy, per-role nonces, instance-bound messages, on_pay callback-only; v2 testnet run; wallet-app redesign; 24 tests',
    status: 'building',
    progress: 85,
    repo: gh('near-hybrid-pq-wallet'),
    nextStep: 'Verifier review of near-hybrid-pq-wallet-judge-redesign.bundle (4577be7); Nick creates the repo',
    flag: 'Portfolio',
    seedVersion: 22,
  },
  {
    id: 'near-null-402',
    name: 'Nyx (near-null-402)',
    pitch: 'Agents pay per API call on NEAR with a zero-knowledge proof; the settlement never names the payer.',
    targets: [near],
    judgeScore: 7,
    scoreNote: 'Plan score. Self-review Oct 21 (our judge agents, not the verifier): 6.5 → 7.5. near-null-402-judge-redesign 3297c8b: payments bound to the gateway URL (relay attack), withdraw path + storage fee, duplicate payments settle once; v2 testnet run; night redesign; 32 tests',
    status: 'building',
    progress: 85,
    repo: gh('near-null-402'),
    nextStep: 'Verifier review of near-null-402-judge-redesign.bundle (3297c8b); Nick creates the repo; NEAR entry stays Q-Day (re-decide ~Nov 8)',
    flag: 'Portfolio',
    seedVersion: 22,
  },
  {
    id: 'zec-null-402',
    name: 'Kippu (zec-null-402)',
    pitch: 'One shielded Zcash deposit, then pay per API call with a zero-knowledge proof: no transaction per call.',
    targets: [zecathonNotEntered],
    judgeScore: 6,
    scoreNote: 'Plan score. Self-review Oct 21 (our judge agents, not the verifier): 5.5 → 6.5. zec-null-402-judge-redesign a8aa033: canonical public signals (no double spend via 0n/hex), challenge + nullifier reserved before the proof check, admin token on anchor, deposit IVK no longer served; ticket-stub redesign; 33 tests + doc',
    status: 'building',
    progress: 85,
    repo: gh('zec-null-402'),
    nextStep: 'Verifier review of zec-null-402-judge-redesign.bundle (a8aa033); Nick creates the repo',
    flag: 'Not entered: portfolio (Zecathon entry is Shielded x402)',
    seedVersion: 22,
  },
  {
    id: 'pq-confidential-intents',
    name: 'Yaksok (PQ intents)',
    pitch: 'Intents signed with ML-DSA-65 and sealed with ML-KEM-768, settled in shielded ZEC, with a signed, anchored decision log.',
    targets: [zecathonNotEntered],
    judgeScore: 6.5,
    scoreNote: 'Plan score. Self-review Oct 21 (our judge agents, not the verifier): 5.5 → 6.5. zec-pq-intents-judge-redesign bbb6df1: fills paid only to configured solver keys, claim window before refunds, canonical base64, MCP pins verifier/escrow/solver keys; terminal redesign; 37 tests + doc',
    status: 'building',
    progress: 85,
    repo: gh('zec-pq-intents'),
    nextStep: 'Verifier review of zec-pq-intents-judge-redesign.bundle (bbb6df1); Nick creates the repo',
    flag: 'Not entered: portfolio (Zecathon entry is Shielded x402)',
    seedVersion: 22,
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
    scoreNote: 'Self-review Oct 21 (our judge agents, not the verifier): 6.0 (before fixes). hasami-redesign 058f815 on hasami-judge-fixes 137f2b4: benchmark 30/30 all-to-tray (90/90 cubes), grasp check + retry, viewfinder/lab-notebook redesign; 138 pass, 1 live skipped + 2 dashboard',
    status: 'building',
    progress: 45,
    repo: gh('hasami'),
    nextStep: 'Nick applies by Oct 25 23:59 ET. BLOCKED: MODEL_API_KEY (dev.meta.ai) for the Muse planner and SAM 3.1, SO-101 arm for a real run (sim works). Verifier review of hasami-redesign.bundle (058f815)',
    flag: 'Check the official rules (published before Oct 26) for a build-window clause',
    seedVersion: 22,
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
