import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLevelFromXp } from '../utils/leveling.js';
import { cumulativeXpForLevel, planRecovery, XP_BUFFER } from '../utils/levelservice.js';

test('cumulativeXpForLevel is monotonic increasing', () => {
    let prev = -1;
    for (let l = 0; l <= 30; l++) {
        const xp = cumulativeXpForLevel(l);
        assert.ok(xp > prev, `level ${l} xp ${xp} should exceed ${prev}`);
        prev = xp;
    }
});

test('cumulativeXpForLevel threshold maps back to the same level', () => {
    // A user granted the recovery XP for level L must actually compute to level L.
    for (let l = 1; l <= 25; l++) {
        const xp = cumulativeXpForLevel(l) + XP_BUFFER;
        assert.equal(calculateLevelFromXp(xp), l, `xp ${xp} should be level ${l}`);
    }
});

test('level 0 requires no XP', () => {
    assert.equal(cumulativeXpForLevel(0), 0);
});

const rewards = [
    { role_id: 'roleA', level: 5 },
    { role_id: 'roleB', level: 10 }
];

test('planRecovery creates a record for a missing user holding a reward role', () => {
    const { changes, skipped } = planRecovery({
        members: [{ id: 'u1', bot: false, roleIds: ['roleA'], name: 'One' }],
        rewards,
        existing: new Map()
    });
    assert.equal(changes.length, 1);
    assert.equal(skipped, 0);
    assert.equal(changes[0].action, 'create');
    assert.equal(changes[0].toLevel, 5);
    assert.equal(changes[0].toXp, cumulativeXpForLevel(5) + XP_BUFFER);
});

test('planRecovery raises a user whose stored level is below their role level', () => {
    const { changes } = planRecovery({
        members: [{ id: 'u1', bot: false, roleIds: ['roleB'], name: 'One' }],
        rewards,
        existing: new Map([['u1', { id: 'rec1', xp: 50 }]]) // ~level 0
    });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].action, 'update');
    assert.equal(changes[0].recordId, 'rec1');
    assert.equal(changes[0].toLevel, 10);
});

test('planRecovery skips a user already at/above their role level', () => {
    const highXp = cumulativeXpForLevel(20);
    const { changes, skipped } = planRecovery({
        members: [{ id: 'u1', bot: false, roleIds: ['roleA'], name: 'One' }],
        rewards,
        existing: new Map([['u1', { id: 'rec1', xp: highXp }]])
    });
    assert.equal(changes.length, 0);
    assert.equal(skipped, 1);
});

test('planRecovery uses the highest matching role level and skips bots / roleless', () => {
    const { changes, skipped } = planRecovery({
        members: [
            { id: 'u1', bot: false, roleIds: ['roleA', 'roleB'], name: 'One' }, // highest = 10
            { id: 'bot1', bot: true, roleIds: ['roleB'], name: 'Bot' },
            { id: 'u2', bot: false, roleIds: ['someOtherRole'], name: 'Two' }
        ],
        rewards,
        existing: new Map()
    });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].userId, 'u1');
    assert.equal(changes[0].toLevel, 10);
    assert.equal(skipped, 2);
});
