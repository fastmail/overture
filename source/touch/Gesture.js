class Gesture {
    constructor(mixin) {
        Object.assign(this, mixin);
    }
    cancel() {}
    start() {}
    move() {}
    end() {}
}

export { Gesture };
