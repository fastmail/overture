// How far back to measure the finger's speed when it lifts, in ms.
const WINDOW = 50;
// Touch moves arrive every frame while the finger moves, so a longer gap
// between two means it was resting until about this long before the later
// one, in ms.
const MAX_MOVE_GAP = 34;

/**
    Class: O.SwipeVelocity

    Measures how fast a finger is moving along one axis as it lifts, for
    carrying a swipe on into the animation that settles it. Feed it every
    move with <#add>; <#at> then gives the speed over at least the last 50ms,
    which follows what the finger was doing as it let go without being
    thrown by the jitter between two touch events.
*/
class SwipeVelocity {
    constructor() {
        this._samples = [];
    }

    /**
        Method: O.SwipeVelocity#add

        Records where the finger was at a moment in the swipe.

        Parameters:
            time     - {Number} The event's timeStamp, in ms.
            position - {Number} The finger's position along the axis, in px.

        Returns:
            {O.SwipeVelocity} Returns self.
    */
    add(time, position) {
        const samples = this._samples;
        samples.push({ time, position });
        // Keep one sample from before the window, so there's still something
        // to measure from when touch events are far apart.
        while (samples.length > 2 && time - samples[1].time >= WINDOW) {
            samples.shift();
        }
        return this;
    }

    /**
        Method: O.SwipeVelocity#at

        The finger's speed as it lifts, over the last 50ms, or since the first
        sample if that is more recent.

        Parameters:
            time     - {Number} The timeStamp of the event ending the swipe.
            position - {Number} The finger's position at the end, in px.

        Returns:
            {Number} The speed in px/s, positive towards a greater position;
            0 if the finger had already stopped moving.
    */
    at(time, position) {
        const samples = this._samples;
        let index = samples.length - 1;
        while (index > 0 && time - samples[index].time < WINDOW) {
            index -= 1;
        }
        const before = samples[index];
        if (!before) {
            return 0;
        }
        const after = samples[index + 1] || { time, position };
        const moveStart = Math.max(before.time, after.time - MAX_MOVE_GAP);
        const startTime = Math.max(time - WINDOW, before.time);
        const startPosition =
            startTime <= moveStart
                ? before.position
                : before.position +
                  ((after.position - before.position) *
                      (startTime - moveStart)) /
                      (after.time - moveStart);
        if (time - startTime < 1) {
            return 0;
        }
        return ((position - startPosition) / (time - startTime)) * 1000;
    }
}

export { SwipeVelocity };
