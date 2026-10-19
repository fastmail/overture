import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { SwipeVelocity } from '../../source/touch/SwipeVelocity.js';

describe('SwipeVelocity', () => {
    test('measures the speed over the last 50ms', () => {
        const velocity = new SwipeVelocity();
        // Slow at first, then 2px/ms for the last 60ms.
        velocity.add(0, 0).add(100, 10);
        for (let time = 110; time <= 160; time += 10) {
            velocity.add(time, 10 + (time - 100) * 2);
        }
        assert.equal(velocity.at(170, 150), 2000);
    });

    test('measures from before the window when events are far apart', () => {
        const velocity = new SwipeVelocity();
        velocity.add(0, 0).add(80, 160);
        // Resting until about 34ms before the move arrived, so still at 0
        // when the window opens at 33ms: 160px in the last 50ms.
        assert.equal(velocity.at(83, 160), 3200);
    });

    test('is negative moving towards a smaller position', () => {
        const velocity = new SwipeVelocity();
        velocity.add(0, 100).add(20, 80).add(40, 60);
        assert.equal(velocity.at(40, 60), -1000);
    });

    test('is 0 once the finger has stopped', () => {
        const velocity = new SwipeVelocity();
        velocity.add(0, 0).add(10, 20);
        assert.equal(velocity.at(200, 20), 0, 'nothing in the window');
        assert.equal(new SwipeVelocity().at(10, 0), 0, 'no samples');
    });
});
