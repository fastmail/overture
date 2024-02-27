class Gesture {
    constructor(mixin) {
        Object.assign(this, mixin);
    }
    cancel() {}
    start() {}
    move() {}
    scroll() {}
    end() {}
}

export { Gesture };
