import { Class, extend } from '../core/Core.js';
import GestureManager from './GestureManager.js';

export default Class({
    init: function ( mixin ) {
        extend( this, mixin );
        GestureManager.register( this );
    },
    destroy: function () {
        GestureManager.deregister( this );
    },
    cancel: function () {},
    start: function () {},
    move: function () {},
    end: function () {},
});
