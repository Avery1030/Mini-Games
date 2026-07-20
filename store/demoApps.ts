import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage, type DemoAppsPersistState } from '@/lib/storage'

const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000
const STAKE_APY = 0.128

const DEFAULTS: DemoAppsPersistState = {
  fakeBalance: 1000,
  claimLastAt: null,
  claimPoints: 0,
  staked: 0,
  referralCode: 'AVERY-DEMO',
  referralInvites: 3,
  referralPoints: 120,
  bridgeHistory: [],
  votes: {},
  proposalFor: { p1: 42, p2: 18, p3: 7 },
  proposalAgainst: { p1: 11, p2: 29, p3: 5 },
  foundryItems: [],
  donationTotal: 0,
  emailDrafts: [],
}

type DemoAppsState = DemoAppsPersistState & {
  claim: () => { ok: boolean; points?: number; waitMs?: number }
  stake: (amount: number) => boolean
  unstake: (amount: number) => boolean
  spend: (amount: number) => boolean
  credit: (amount: number) => void
  refreshReferralCode: () => string
  addBridge: (from: string, to: string, amount: number) => void
  vote: (proposalId: string, side: 'for' | 'against') => boolean
  mintFoundry: (name: string, rarity: string) => void
  donate: (amount: number) => boolean
  addEmailDraft: (draft: { to: string; subject: string; body: string }) => void
  removeEmailDraft: (id: string) => void
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function randomCode() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `AVERY-${part()}-${part()}`
}

export const useDemoAppsStore = create<DemoAppsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,

      claim: () => {
        const { claimLastAt, claimPoints, fakeBalance } = get()
        const now = Date.now()
        if (claimLastAt != null && now - claimLastAt < CLAIM_COOLDOWN_MS) {
          return { ok: false, waitMs: CLAIM_COOLDOWN_MS - (now - claimLastAt) }
        }
        const points = 50
        set({
          claimLastAt: now,
          claimPoints: claimPoints + points,
          fakeBalance: fakeBalance + points,
        })
        return { ok: true, points }
      },

      stake: (amount) => {
        const n = Math.floor(amount)
        if (!Number.isFinite(n) || n <= 0) return false
        const { fakeBalance, staked } = get()
        if (n > fakeBalance) return false
        set({ fakeBalance: fakeBalance - n, staked: staked + n })
        return true
      },

      unstake: (amount) => {
        const n = Math.floor(amount)
        if (!Number.isFinite(n) || n <= 0) return false
        const { fakeBalance, staked } = get()
        if (n > staked) return false
        set({ fakeBalance: fakeBalance + n, staked: staked - n })
        return true
      },

      spend: (amount) => {
        const n = Math.floor(amount)
        if (!Number.isFinite(n) || n <= 0) return false
        const { fakeBalance } = get()
        if (n > fakeBalance) return false
        set({ fakeBalance: fakeBalance - n })
        return true
      },

      credit: (amount) => {
        const n = Math.floor(amount)
        if (!Number.isFinite(n) || n <= 0) return
        set({ fakeBalance: get().fakeBalance + n })
      },

      refreshReferralCode: () => {
        const code = randomCode()
        set({ referralCode: code })
        return code
      },

      addBridge: (from, to, amount) => {
        const n = Math.floor(amount)
        if (!Number.isFinite(n) || n <= 0) return
        const { fakeBalance, bridgeHistory } = get()
        if (n > fakeBalance) return
        set({
          fakeBalance: fakeBalance - n,
          bridgeHistory: [
            { id: uid('br'), from, to, amount: n, at: Date.now() },
            ...bridgeHistory,
          ].slice(0, 20),
        })
      },

      vote: (proposalId, side) => {
        const { votes, proposalFor, proposalAgainst } = get()
        if (votes[proposalId]) return false
        const forMap = { ...proposalFor }
        const againstMap = { ...proposalAgainst }
        if (side === 'for') forMap[proposalId] = (forMap[proposalId] ?? 0) + 1
        else againstMap[proposalId] = (againstMap[proposalId] ?? 0) + 1
        set({
          votes: { ...votes, [proposalId]: side },
          proposalFor: forMap,
          proposalAgainst: againstMap,
        })
        return true
      },

      mintFoundry: (name, rarity) => {
        set({
          foundryItems: [
            { id: uid('ft'), name, rarity, at: Date.now() },
            ...get().foundryItems,
          ].slice(0, 30),
        })
      },

      donate: (amount) => {
        const n = Math.floor(amount)
        if (!Number.isFinite(n) || n <= 0) return false
        const { fakeBalance, donationTotal } = get()
        if (n > fakeBalance) return false
        set({ fakeBalance: fakeBalance - n, donationTotal: donationTotal + n })
        return true
      },

      addEmailDraft: ({ to, subject, body }) => {
        set({
          emailDrafts: [
            {
              id: uid('em'),
              to: to.trim().slice(0, 120),
              subject: subject.trim().slice(0, 120) || '(no subject)',
              body: body.trim().slice(0, 2000),
              at: Date.now(),
            },
            ...get().emailDrafts,
          ].slice(0, 40),
        })
      },

      removeEmailDraft: (id) => {
        set({ emailDrafts: get().emailDrafts.filter((d) => d.id !== id) })
      },
    }),
    {
      name: STORAGE_KEYS.demoApps,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s) => ({
        fakeBalance: s.fakeBalance,
        claimLastAt: s.claimLastAt,
        claimPoints: s.claimPoints,
        staked: s.staked,
        referralCode: s.referralCode,
        referralInvites: s.referralInvites,
        referralPoints: s.referralPoints,
        bridgeHistory: s.bridgeHistory,
        votes: s.votes,
        proposalFor: s.proposalFor,
        proposalAgainst: s.proposalAgainst,
        foundryItems: s.foundryItems,
        donationTotal: s.donationTotal,
        emailDrafts: s.emailDrafts,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<DemoAppsPersistState>
        return {
          ...current,
          ...DEFAULTS,
          ...saved,
          fakeBalance: typeof saved.fakeBalance === 'number' ? saved.fakeBalance : DEFAULTS.fakeBalance,
          bridgeHistory: Array.isArray(saved.bridgeHistory) ? saved.bridgeHistory : DEFAULTS.bridgeHistory,
          votes: saved.votes && typeof saved.votes === 'object' ? saved.votes : DEFAULTS.votes,
          proposalFor:
            saved.proposalFor && typeof saved.proposalFor === 'object' ? saved.proposalFor : DEFAULTS.proposalFor,
          proposalAgainst:
            saved.proposalAgainst && typeof saved.proposalAgainst === 'object'
              ? saved.proposalAgainst
              : DEFAULTS.proposalAgainst,
          foundryItems: Array.isArray(saved.foundryItems) ? saved.foundryItems : DEFAULTS.foundryItems,
          emailDrafts: Array.isArray(saved.emailDrafts) ? saved.emailDrafts : DEFAULTS.emailDrafts,
        }
      },
    },
  ),
)

export const DEMO_STAKE_APY = STAKE_APY
export const DEMO_CLAIM_COOLDOWN_MS = CLAIM_COOLDOWN_MS
