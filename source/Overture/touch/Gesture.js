import { Class } from '../core/Core';
import GestureManager from './GestureManager';

export default Class({
    init ( mixin ) {
        Object.assign( this, mixin );
        GestureManager.register( this );
    },
    destroy () {
        GestureManager.deregister( this );
    },
    cancel () {},
    start () {},
    move () {},
    end () {},
});
