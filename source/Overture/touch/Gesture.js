import { Class } from '../core/Core.js';
import GestureManager from './GestureManager.js';

export default Class({
    init( mixin ) {
        Object.assign( this, mixin );
        GestureManager.register( this );
    },
    destroy() {
        GestureManager.deregister( this );
    },
    cancel() {},
    start() {},
    move() {},
    end() {},
});
