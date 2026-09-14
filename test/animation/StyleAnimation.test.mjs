import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    cssEasing,
    Easing,
    fitCubicBezier,
    isUnset,
    makeElement,
    makeObject,
    reducedMotionQuery,
    StyleAnimation,
    wait,
} from './helpers.mjs';

const { linear, ease, bouncelessSpring } = Easing;

const setup = (current) => {
    const element = makeElement();
    const object = makeObject();
    const animation = new StyleAnimation({ object, element });
    animation.current = current;
    return { element, object, animation };
};

describe('StyleAnimation', () => {
    test('animates transform and opacity with the browser', () => {
        const { element, object, animation } = setup({
            position: 'absolute',
            transform: 'translate3d(100%,0,0)',
            opacity: 0,
        });
        animation.animate(
            {
                position: 'absolute',
                transform: 'translate3d(0,0,0)',
                opacity: 1,
            },
            200,
            linear,
        );

        assert.equal(animation.isRunning, true);
        assert.equal(object.animating, 1);
        // The end state is on the element; the browser animates towards it.
        assert.equal(element.style.transform, 'translate3d(0,0,0)');
        assert.equal(element.style.opacity, 1);
        assert.equal(element.style.position, undefined, 'unchanged not set');

        // One animation carries every property.
        assert.equal(element.animations.length, 1);
        const [webAnimation] = element.animations;
        assert.deepEqual(webAnimation.keyframes, [
            { transform: 'translate3d(100%,0,0)', opacity: '0' },
            { transform: 'translate3d(0,0,0)', opacity: '1' },
        ]);
        assert.deepEqual(webAnimation.options, {
            duration: 200,
            easing: 'linear',
        });
        assert.deepEqual(animation.animated, ['transform', 'opacity']);

        webAnimation.finish();
        assert.equal(animation.isRunning, false);
        assert.equal(object.animating, 0);
        assert.deepEqual(object.events, ['will', 'did']);
        assert.deepEqual(animation.current, {
            position: 'absolute',
            transform: 'translate3d(0,0,0)',
            opacity: 1,
        });
    });

    test('sets styles it cannot animate immediately', () => {
        const { element, object, animation } = setup({
            top: 10,
            zIndex: 1,
            color: 'red',
        });
        animation.animate({ top: 10, zIndex: 2, color: 'blue' }, 200);

        assert.equal(animation.isRunning, false);
        assert.equal(object.animating, 0);
        assert.deepEqual(object.events, []);
        assert.equal(element.animations.length, 0);
        assert.equal(element.style.zIndex, 2);
        assert.equal(element.style.color, 'blue');
        assert.equal(element.style.top, undefined);
    });

    test('holds a layout change the browser cannot interpolate for the duration', async () => {
        const { element, object, animation } = setup({ height: 'auto' });
        animation.animate({ height: 240, top: 10 }, 20);

        assert.equal(element.style.height, '240px');
        assert.equal(element.style.top, '10px');
        assert.equal(element.animations.length, 0);
        assert.equal(animation.isRunning, true);
        assert.deepEqual(animation.animated, ['height', 'top']);

        await wait(60);

        assert.equal(animation.isRunning, false);
        assert.deepEqual(object.events, ['will', 'did']);
    });

    test('runs a px change in top as a transform', () => {
        const { element, animation } = setup({
            top: 100,
            left: 0,
            transform: 'none',
            opacity: 1,
        });
        animation.animate(
            { top: 40, left: 0, transform: 'none', opacity: 1 },
            200,
            linear,
        );

        assert.equal(element.style.top, '40px');
        assert.equal(element.animations.length, 1);
        assert.deepEqual(element.animations[0].keyframes, [
            { transform: 'translate3d(0,60px,0)' },
            { transform: 'none' },
        ]);
        assert.deepEqual(animation.animated, ['top', 'transform']);
    });

    test('keeps a horizontal translate when moving top as a transform', () => {
        const { element, animation } = setup({
            top: 0,
            transform: 'translate3d(20px,0,0)',
        });
        animation.animate({ top: 50, transform: 'translate3d(20px,0,0)' }, 200);
        assert.deepEqual(element.animations[0].keyframes, [
            { transform: 'translate3d(20px,-50px,0)' },
            { transform: 'translate3d(20px,0,0)' },
        ]);
    });

    test('animates top itself when not in px or transform is not a translate', () => {
        const percent = setup({ top: '10%' });
        percent.animation.animate({ top: '20%' }, 200);
        assert.deepEqual(percent.element.animations[0].keyframes, [
            { top: '10%' },
            { top: '20%' },
        ]);
        assert.equal(percent.element.style.top, '20%');

        const rotated = setup({ top: 0, transform: 'rotate(180deg)' });
        rotated.animation.animate(
            { top: 30, transform: 'rotate(180deg)' },
            200,
        );
        assert.deepEqual(rotated.element.animations[0].keyframes, [
            { top: '0px' },
            { top: '30px' },
        ]);
    });

    test('continues from the current position when interrupted', () => {
        const { element, object, animation } = setup({ opacity: 0 });
        animation.animate({ opacity: 1 }, 100, linear);
        const first = element.animations[0];
        first.currentTime = 50;

        animation.animate({ opacity: 0 }, 100, linear);

        assert.equal(first.isCancelled, true);
        assert.equal(first.onfinish, null);
        assert.equal(element.animations.length, 2);
        assert.deepEqual(element.animations[1].keyframes, [
            { opacity: '0.5' },
            { opacity: '0' },
        ]);
        assert.deepEqual(object.events, ['will', 'did', 'will']);
        assert.equal(object.animating, 1);
    });

    test('writes the interrupted value even when it is the new target', () => {
        const { element, animation } = setup({ opacity: 0 });
        animation.animate({ opacity: 1 }, 100, linear);
        assert.equal(element.style.opacity, 1);

        // Still play-pending, so visually at the start.
        animation.animate({ opacity: 0 }, 100, linear);

        assert.equal(animation.isRunning, false, 'nothing to animate');
        assert.equal(element.animations.length, 1);
        assert.equal(element.style.opacity, '0');
        assert.equal(animation.current.opacity, 0);
    });

    test('restarts an interrupted top move from where the transform is', () => {
        const { element, animation } = setup({ top: 0 });
        animation.animate({ top: 100 }, 100, linear);
        element.animations[0].currentTime = 50;

        animation.animate({ top: 200 }, 100, linear);

        assert.equal(element.style.top, '200px');
        assert.deepEqual(element.animations[1].keyframes, [
            { transform: 'translate3d(0,-150px,0)' },
            { transform: 'none' },
        ]);
        assert.equal(animation.current.transform, undefined);
    });

    test('interpolates the easing the browser is using', () => {
        const { element, animation } = setup({ opacity: 0 });
        animation.animate({ opacity: 1 }, 100, ease);
        element.animations[0].currentTime = 50;
        animation.animate({ opacity: 0 }, 100, ease);
        const expected = String(ease(0.5));
        assert.deepEqual(element.animations[1].keyframes[0], {
            opacity: expected,
        });
    });

    test('defers display none and overflow visible to the end', async () => {
        const { element, object, animation } = setup({
            display: 'block',
            overflow: 'hidden',
        });
        animation.animate({ display: 'none', overflow: 'visible' }, 20);

        assert.equal(animation.isRunning, true);
        assert.equal(element.animations.length, 0);
        assert.equal(element.style.display, undefined);
        assert.equal(element.style.overflow, undefined);
        assert.equal(animation.current.display, 'block');

        await wait(60);

        assert.equal(animation.isRunning, false);
        assert.equal(element.style.display, 'none');
        assert.equal(element.style.overflow, 'visible');
        assert.equal(animation.current.display, 'none');
        assert.deepEqual(object.events, ['will', 'did']);
    });

    test('applies other display and overflow values at the start', () => {
        const { element, animation } = setup({
            display: 'none',
            overflow: 'visible',
        });
        animation.animate({ display: 'block', overflow: 'hidden' }, 200);
        assert.equal(element.style.display, 'block');
        assert.equal(element.style.overflow, 'hidden');
        assert.equal(animation.isRunning, true);
        animation.stop();
    });

    test('stop jumps to the end state', () => {
        const { element, object, animation } = setup({
            display: 'block',
            opacity: 1,
        });
        animation.animate({ display: 'none', opacity: 0 }, 200);
        animation.stop();

        assert.equal(animation.isRunning, false);
        assert.equal(element.style.display, 'none');
        assert.equal(element.animations[0].isCancelled, true);
        assert.deepEqual(object.events, ['will', 'did']);
        animation.stop();
        assert.deepEqual(object.events, ['will', 'did'], 'stop twice is safe');
    });

    test('a deferred display change is dropped if interrupted', () => {
        const { element, animation } = setup({ display: 'block', opacity: 1 });
        animation.animate({ display: 'none', opacity: 0 }, 200);
        animation.animate({ display: 'block', opacity: 1 }, 200);
        animation.stop();
        assert.equal(element.style.display, undefined, 'never hidden');
        assert.equal(animation.current.display, 'block');
    });

    test('animates a removed opacity back to 1 then clears it', () => {
        const { element, animation } = setup({ top: 0, opacity: 0.5 });
        animation.animate({ top: 0 }, 200);
        assert.ok(isUnset(element.style.opacity));
        assert.deepEqual(element.animations[0].keyframes, [
            { opacity: '0.5' },
            { opacity: '1' },
        ]);
        assert.deepEqual(animation.animated, ['opacity']);
        assert.deepEqual(animation.current, { top: 0 });
    });

    test('removes other styles immediately', () => {
        const { element, animation } = setup({ top: 10, zIndex: 2 });
        animation.animate({ top: 10 }, 200);
        assert.equal(animation.isRunning, false);
        assert.ok(isUnset(element.style.zIndex));
        assert.deepEqual(animation.current, { top: 10 });
    });

    test('treats undefined values as absent', () => {
        const { element, animation } = setup({ top: 0, opacity: 1 });
        animation.animate({ top: 0, opacity: undefined }, 200);
        assert.ok(isUnset(element.style.opacity));
        assert.deepEqual(animation.current, { top: 0 });
        assert.deepEqual(animation.animated, ['opacity']);
    });

    // HierarchyPaneView relies on this: adding `opacity: 1` to an otherwise
    // unchanged layout must still run for the duration so the pane stays in
    // the document while another slides over it.
    test('runs for the duration when a property matching its default appears or disappears', () => {
        const { element, object, animation } = setup({
            transform: 'translate3d(0,0,0)',
        });
        animation.animate({ transform: 'translate3d(0,0,0)', opacity: 1 }, 200);
        assert.equal(animation.isRunning, true);
        assert.equal(object.animating, 1);
        assert.deepEqual(animation.animated, ['opacity']);
        assert.deepEqual(element.animations[0].keyframes, [
            { opacity: '1' },
            { opacity: '1' },
        ]);
        element.animations[0].finish();
        assert.equal(animation.isRunning, false);

        animation.animate({ transform: 'translate3d(0,0,0)' }, 200);
        assert.equal(animation.isRunning, true);
        assert.deepEqual(animation.animated, ['opacity']);
        assert.ok(isUnset(element.style.opacity));
        element.animations[1].finish();
        assert.equal(animation.isRunning, false);
        assert.deepEqual(object.events, ['will', 'did', 'will', 'did']);
    });

    test('set applies changes immediately and stops a running animation', () => {
        const { element, object, animation } = setup({
            top: 0,
            opacity: 1,
            zIndex: 1,
        });
        animation.animate({ top: 100, opacity: 1, zIndex: 1 }, 200);
        animation.set({ top: 50, opacity: 0.5 });

        assert.equal(animation.isRunning, false);
        assert.equal(element.animations[0].isCancelled, true);
        assert.equal(element.style.top, '50px');
        assert.equal(element.style.opacity, 0.5);
        assert.ok(isUnset(element.style.zIndex));
        assert.deepEqual(animation.current, { top: 50, opacity: 0.5 });
        assert.deepEqual(object.events, ['will', 'did']);
    });

    test('set skips styles that are already applied', () => {
        const { element, animation } = setup({ top: 10, transform: '' });
        animation.set({ top: '10px', transform: 'none', opacity: 1 });
        assert.equal(element.style.top, undefined);
        assert.equal(element.style.transform, undefined);
        assert.equal(element.style.opacity, 1, 'new property is written');
    });

    test('jumps to the end when the user prefers reduced motion', async () => {
        reducedMotionQuery.set(true);
        try {
            const { element, object, animation } = setup({ opacity: 0 });
            animation.animate({ opacity: 1 }, 300);
            assert.equal(element.animations.length, 0, 'no Web Animation');
            assert.equal(element.style.opacity, 1);
            assert.equal(animation.isRunning, true);
            await wait(20);
            assert.equal(animation.isRunning, false);
            assert.deepEqual(object.events, ['will', 'did']);
        } finally {
            reducedMotionQuery.set(false);
        }
    });

    test('keeps the previous duration and easing if none given', () => {
        const { element, animation } = setup({ opacity: 0 });
        animation.animate({ opacity: 1 }, 150, linear);
        animation.stop();
        animation.animate({ opacity: 0 });
        assert.deepEqual(element.animations[1].options, {
            duration: 150,
            easing: 'linear',
        });
    });
});

describe('cssEasing', () => {
    test('passes cubic beziers through exactly', () => {
        assert.equal(cssEasing(ease), 'cubic-bezier(0.25,0.1,0.25,1)');
        assert.equal(cssEasing(linear), 'linear');
    });

    test('samples other curves into linear() and evaluates the same curve', () => {
        const spring = bouncelessSpring({ mass: 0.23, stiffness: 30 });
        const css = cssEasing(spring);
        const samples = css.slice('linear('.length, -1).split(', ');

        assert.equal(samples.length, 41);
        assert.equal(samples[0], '0');
        assert.equal(spring.cssName, css, 'cached on the function');

        for (const x of [0, 0.1, 0.33, 0.5125, 0.9, 1]) {
            assert.ok(
                Math.abs(spring.cssEquivalent(x) - spring(x)) < 0.01,
                `matches the spring at ${x}`,
            );
        }
        assert.equal(spring.cssEquivalent(0.5), Number(samples[20]));
    });

    test('fits a cubic bezier to a spring for browsers without linear()', () => {
        const maxError = (curve, spring) => {
            let max = 0;
            for (let i = 0; i <= 100; i += 1) {
                max = Math.max(max, Math.abs(curve(i / 100) - spring(i / 100)));
            }
            return max;
        };
        for (const options of [
            { velocity: 1, mass: 0.23, stiffness: 30 },
            { mass: 0.8, stiffness: 60 },
        ]) {
            const spring = bouncelessSpring(options);
            const bezier = fitCubicBezier(spring);
            assert.match(bezier.cssName, /^cubic-bezier\(/);
            assert.ok(maxError(bezier, spring) < 0.06, 'close to the spring');
        }
    });
});
