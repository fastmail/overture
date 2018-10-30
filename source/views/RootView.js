import { Class } from '../core/Core';
import '../foundation/EventTarget';  // For Function#on
import '../foundation/RunLoop';  // For Function#invokeInRunLoop
import UA from '../ua/UA';

import View from './View';
import ViewEventsController from './ViewEventsController';
import { getViewFromNode } from './activeViews';
import ScrollView from './containers/ScrollView';
import AbstractControlView from './controls/AbstractControlView';


let passiveSupported = false;

try {
    const options = Object.defineProperty( {}, 'passive', {
        get () {
            passiveSupported = true;
        },
    });
    window.addEventListener( 'test', options, options);
    window.removeEventListener( 'test', options, options);
} catch ( error ) {
    passiveSupported = false;
}

/**
    Class: O.RootView

    Extends: O.View

    An O.RootView instance uses an existing DOM node for its layer, and forms
    the root of the O.View tree making up your application. The root view adds
    DOM event listeners to its layer to observe and dispatch events for the
    whole view hierarchy.

        MyApp.views.mainWindow = new O.RootView( document );

    Normally, you will create an O.RootView instance with the document node for
    each window in your application, but if your application is not taking over
    the full page, it can be initiated with any other node already in the
    document.
*/
const RootView = Class({

    Extends: View,

    syncOnlyInDocument: false,

    layer: null,

    init ( node /*, ...mixins */) {
        RootView.parent.constructor.apply( this,
            Array.prototype.slice.call( arguments, 1 ) );

        // Node.DOCUMENT_NODE => 9.
        const nodeIsDocument = ( node.nodeType === 9 );
        const doc = nodeIsDocument ? node : node.ownerDocument;
        const win = doc.defaultView;
        let l;
        let events = [
            'click', 'mousedown', 'mouseup', 'dblclick',
            'keypress', 'keydown', 'keyup',
            'dragstart',
            'touchstart', 'touchmove', 'touchend', 'touchcancel',
            'wheel',
            'cut',
            'submit',
        ];
        for ( l = events.length; l--; ) {
            node.addEventListener( events[l], this, passiveSupported ? {
                passive: false,
            } : false );
        }
        // These events don't bubble: have to capture.
        // In IE, we use a version of focus and blur which will bubble, but
        // there's no way of bubbling/capturing change and input.
        // These events are automatically added to all inputs when created
        // instead.
        events = [ 'focus', 'blur', 'change', 'input' ];
        for ( l = events.length; l--; ) {
            node.addEventListener( events[l], this, true );
        }
        events = [ 'resize', 'scroll' ];
        for ( l = events.length; l--; ) {
            win.addEventListener( events[l], this, false );
        }

        this.isRendered = true;
        this.isInDocument = true;
        this.layer = nodeIsDocument ? node.body : node;
    },

    safeAreaInsetBottom: 0,

    _onScroll: function ( event ) {
        const layer = this.get( 'layer' );
        const isBody = ( layer.nodeName === 'BODY' );
        const doc = layer.ownerDocument;
        const win = doc.defaultView;
        const left = isBody ? win.pageXOffset : layer.scrollLeft;
        const top = isBody ? win.pageYOffset : layer.scrollTop;
        this.beginPropertyChanges()
                .set( 'scrollLeft', left )
                .set( 'scrollTop', top )
            .endPropertyChanges();
        event.stopPropagation();
    }.on( 'scroll' ),

    preventRootScroll: UA.isIOS ? function ( event ) {
        const view = event.targetView;
        if ( !( view instanceof ScrollView ) &&
                !view.getParent( ScrollView ) ) {
            const doc = this.layer.ownerDocument;
            const win = doc.defaultView;
            if ( this.get( 'pxHeight' ) <= win.innerHeight &&
                    !/^(?:INPUT|TEXTAREA)$/.test(
                        doc.activeElement.nodeName ) ) {
                event.preventDefault();
            }
        }
    }.on( 'touchmove' ) : null,

    focus () {
        const layer = this.get( 'layer' );
        const activeElement = layer.ownerDocument.activeElement;
        const view = getViewFromNode( activeElement );
        if ( view instanceof AbstractControlView ) {
            view.blur();
        } else if ( activeElement.blur ) {
            activeElement.blur();
        }
    },

    pxTop: 0,
    pxLeft: 0,

    handleEvent: function ( event ) {
        switch ( event.type ) {
        // We observe mousemove when mousedown.
        case 'mousedown':
            this.get( 'layer' ).ownerDocument
                .addEventListener( 'mousemove', this, false );
            break;
        case 'mouseup':
            this.get( 'layer' ).ownerDocument
                .removeEventListener( 'mousemove', this, false );
            break;
        // Window resize events: just notify parent has resized.
        case 'resize':
            this.didResize();
            return;
        // Scroll events are special.
        case 'scroll':
            this._onScroll( event );
            return;
        }
        ViewEventsController.handleEvent( event, null, this );
    }.invokeInRunLoop(),
});

export default RootView;
