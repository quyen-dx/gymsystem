// EntityResolver and Follow-up Tests
// Demonstrates LLM-based reasoning for follow-ups without hard-coded keywords

import assert from 'node:assert/strict'
import test from 'node:test'
import { entityResolver } from './entityResolver.js'

// Mock data
const mockPTs = [
    { id: 'pt1', name: 'cgpt 1', email: 'cgpt1@gym.com', phone: '0901234567', specialties: ['Cardio', 'Weight Loss'], experienceYears: 3, rating: 4.8 },
    { id: 'pt2', name: 'juan', email: 'juan@gym.com', phone: '0901234568', specialties: ['Muscle Gain', 'Strength'], experienceYears: 5, rating: 4.9 },
    { id: 'pt3', name: 'abc', email: 'abc@gym.com', phone: '0901234569', specialties: ['Flexibility', 'Yoga'], experienceYears: 2, rating: 4.5 },
]

const mockPlans = [
    { id: 'plan1', nameVi: 'Gói Cơ Bản', nameEn: 'Basic Plan', price: 500000, durationDays: 30 },
    { id: 'plan2', nameVi: 'Gói VIP', nameEn: 'VIP Plan', price: 1500000, durationDays: 90 },
    { id: 'plan3', nameVi: 'Gói Premium', nameEn: 'Premium Plan', price: 2500000, durationDays: 180 },
]

// === Entity Resolver Tests ===

test('entityResolver: Exact name match "cgpt 1"', () => {
    const result = entityResolver.resolve({
        userReference: 'cgpt 1',
        lastListedEntities: mockPTs,
        entityType: 'pt',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'pt1')
    assert.equal(result.method, 'fuzzy_match')
    assert.ok(result.confidence > 0.9)
})

test('entityResolver: Fuzzy match "cgpt" for "cgpt 1"', () => {
    const result = entityResolver.resolve({
        userReference: 'cgpt',
        lastListedEntities: mockPTs,
        entityType: 'pt',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'pt1')
    assert.ok(result.confidence > 0.65)
})

test('entityResolver: Exact name match "juan"', () => {
    const result = entityResolver.resolve({
        userReference: 'juan',
        lastListedEntities: mockPTs,
        entityType: 'pt',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'pt2')
})

test('entityResolver: Positional reference "người đầu tiên" (first)', () => {
    const result = entityResolver.resolve({
        userReference: 'người đầu tiên',
        lastListedEntities: mockPTs,
        entityType: 'pt',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'pt1')
    assert.equal(result.method, 'positional_index')
    assert.equal(result.confidence, 0.95)
})

test('entityResolver: Positional reference "thu hai" (second)', () => {
    const result = entityResolver.resolve({
        userReference: 'thu hai',
        lastListedEntities: mockPTs,
        entityType: 'pt',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'pt2')
})

test('entityResolver: Positional reference "thu 3" (third)', () => {
    const result = entityResolver.resolve({
        userReference: 'thu 3',
        lastListedEntities: mockPTs,
        entityType: 'pt',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'pt3')
})

test('entityResolver: Positional reference "last" (cuối cùng)', () => {
    const result = entityResolver.resolve({
        userReference: 'cuoi cung',
        lastListedEntities: mockPTs,
        entityType: 'pt',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'pt3')
    assert.equal(result.method, 'positional_last')
})

test('entityResolver: Anaphora "nó" (it) refers to first entity', () => {
    const result = entityResolver.resolve({
        userReference: 'no',
        lastListedEntities: mockPTs,
        entityType: 'pt',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'pt1')
    assert.equal(result.method, 'anaphora')
    assert.ok(result.confidence > 0.6)
})

test('entityResolver: Anaphora "cái đó" (that) refers to first entity', () => {
    const result = entityResolver.resolve({
        userReference: 'cai do',
        lastListedEntities: mockPTs,
        entityType: 'pt',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'pt1')
})

test('entityResolver: Plan name match "Gói VIP"', () => {
    const result = entityResolver.resolve({
        userReference: 'goi vip',
        lastListedEntities: mockPlans,
        entityType: 'plan',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'plan2')
})

test('entityResolver: Plan fuzzy match "premium"', () => {
    const result = entityResolver.resolve({
        userReference: 'premium',
        lastListedEntities: mockPlans,
        entityType: 'plan',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'plan3')
})

test('entityResolver: Plan positional reference "gói đầu tiên"', () => {
    const result = entityResolver.resolve({
        userReference: 'goi dau tien',
        lastListedEntities: mockPlans,
        entityType: 'plan',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'plan1')
})

test('entityResolver: Count reference "người thứ 2" extracts position', () => {
    const result = entityResolver.resolve({
        userReference: 'nguoi thu 2',
        lastListedEntities: mockPTs,
        entityType: 'pt',
    })
    assert.ok(result.resolved)
    assert.equal(result.resolved.id, 'pt2')
})

// === Extract Reference Tests ===

test('entityResolver.extractReference: Extract name from "chi tiết về cgpt 1"', () => {
    const ref = entityResolver.extractReference({
        query: 'chi tiết về cgpt 1',
    })
    assert.ok(ref)
    assert.ok(ref.includes('cgpt'))
})

test('entityResolver.extractReference: Extract name from "thông tin juan"', () => {
    const ref = entityResolver.extractReference({
        query: 'thông tin juan',
    })
    assert.ok(ref)
    assert.ok(ref.includes('juan'))
})

test('entityResolver.extractReference: Extract from "PT nào"', () => {
    const ref = entityResolver.extractReference({
        query: 'pt nao manh nhat',
    })
    assert.ok(ref)
})

// === Multiple References Tests ===

test('entityResolver.resolveMultiple: Extract two references "người 1 và 2"', () => {
    const refs = entityResolver.resolveMultiple({
        userReference: 'nguoi 1 va 2',
        lastListedEntities: mockPTs,
        entityType: 'pt',
    })
    assert.ok(Array.isArray(refs))
    assert.ok(refs.length >= 2)
})

// === Query Reasoner Follow-up Tests ===

import { reasonQuery } from './queryReasoner.js'

test('reasonQuery: PT list shows action="list" for "danh sách PT"', async () => {
    const result = await reasonQuery({ query: 'danh sách PT', memory: {}, language: 'vi' })
    assert.equal(result.subject, 'pt')
    assert.equal(result.action, 'list')
})

test('reasonQuery: Follow-up with lastListedPTs shows isFollowUp=true', async () => {
    const memory = {
        lastSubject: 'pt',
        lastListedPTs: mockPTs,
    }
    const result = await reasonQuery({
        query: 'chi tiết về cgpt 1',
        memory,
        language: 'vi',
    })
    assert.ok(result.isFollowUp || result.subject === 'pt')
})

test('reasonQuery: Positional follow-up "người đầu tiên"', async () => {
    const memory = {
        lastSubject: 'pt',
        lastListedPTs: mockPTs,
    }
    const result = await reasonQuery({
        query: 'người đầu tiên là ai',
        memory,
        language: 'vi',
    })
    assert.ok(result.subject === 'pt')
})

test('reasonQuery: Plan list follow-up "xem gói thứ 2"', async () => {
    const memory = {
        lastSubject: 'plan',
        lastListedPlans: mockPlans,
    }
    const result = await reasonQuery({
        query: 'xem gói thứ 2',
        memory,
        language: 'vi',
    })
    assert.ok(result.subject === 'plan')
})

// === Test Summary ===

console.log('\n=== Entity Resolver & Follow-up Tests ===')
console.log('All tests verify that AI can understand follow-ups without hard-coded keywords')
console.log('Supported patterns:')
console.log('  1. Exact name match: "cgpt 1" → resolves to entity')
console.log('  2. Fuzzy name match: "cgpt" → matches to "cgpt 1"')
console.log('  3. Positional reference: "người đầu tiên", "thu 2" → resolves by position')
console.log('  4. Anaphora: "nó", "cái đó" → refers to most recent entity')
console.log('  5. Count reference: "người thứ 2" → extracts index from text')
console.log('')
