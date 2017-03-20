import { Class } from '../../core/Core.js';
import '../../foundation/ComputedProps.js';  // For Function#property
import '../../foundation/EventTarget.js';  // For Function#on
import '../../foundation/ObservableProps.js';  // For Function#observes
import RunLoop from '../../foundation/RunLoop.js';  // Also Function#queue
import { bindTwoWay } from '../../foundation/Binding.js';
import DOMEvent from '../../dom/DOMEvent.js';
import View from '../View.js';
import RootView from '../RootView.js';
import ViewEventsController from '../ViewEventsController.js';
import ScrollView from '../containers/ScrollView.js';
import PopOverView from '../panels/PopOverView.js';
import SearchTextView from './SearchTextView.js';
import MenuController from './MenuController.js';
import MenuOptionView from './MenuOptionView.js';

const MenuView = Class({

    Extends: View,

    className: 'v-Menu',

    showFilter: false,
    closeOnActivate: true,

    didCreateLayer: function ( layer ) {
        MenuView.parent.didCreateLayer.call( this, layer );
        layer.addEventListener( 'mousemove', this, false );
        layer.addEventListener( 'mouseout', this, false );
    },

    willDestroyLayer: function ( layer ) {
        layer.removeEventListener( 'mouseout', this, false );
        layer.removeEventListener( 'mousemove', this, false );
        MenuView.parent.willDestroyLayer.call( this, layer );
    },

    didEnterDocument: function () {
        MenuView.parent.didEnterDocument.call( this );
        const scrollView = this._scrollView;
        let windowHeight, delta, controller, input;
        if ( scrollView ) {
            windowHeight = ( this.getParent( ScrollView ) ||
                this.getParent( RootView ) ).get( 'pxHeight' );
            delta = this.get( 'layer' ).getBoundingClientRect().bottom -
                windowHeight;
            // Must redraw immediately so size is correct when PopOverView
            // checks if it is positioned off screen.
            scrollView.set( 'layout', {
                maxHeight: Math.max(
                    scrollView.get( 'pxHeight' ) - delta - 10,
                    windowHeight / 2
                ),
            }).redraw();
        }

        if ( this.get( 'showFilter' ) ) {
            controller = this.get( 'controller' );
            input = this._input;
            if ( !controller.get( 'focussedOption' ) ) {
                controller.focusNext();
            }
            RunLoop.invokeInNextFrame( function () {
                input.focus().set( 'selection', {
                    start: 0,
                    end: input.get( 'value' ).length,
                });
            });
        }
        return this;
    },

    didLeaveDocument: function () {
        const controller = this.get( 'controller' );
        if ( this.get( 'showFilter' ) ) {
            controller.set( 'filter', '' );
        } else {
            controller.focusOption( null );
        }
        return MenuView.parent.didLeaveDocument.call( this );
    },

    mayHaveResized: function () {
        this.parentViewDidResize();
    }.queue( 'after' ).observes( 'controller.filter' ),

    nextEventTarget: function () {
        return this.get( 'controller' );
    }.property( 'controller' ),

    controller: function () {
        return new MenuController({
            view: this,
        });
    }.property(),

    ItemView: MenuOptionView,

    draw: function ( layer, Element, el ) {
        const controller = this.get( 'controller' );
        const MenuOptionView = this.get( 'ItemView' );
        const optionViews = this.get( 'options' ).map( function ( view ) {
            return new MenuOptionView( view, controller );
        });
        controller.set( 'options', optionViews );
        return [
            this.get( 'showFilter' ) ? el( 'div.v-Menu-filter', [
                this._input = new SearchTextView({
                    blurOnEscape: false,
                    value: bindTwoWay( 'filter', this.get( 'controller' ) ),
                }),
            ]) : null,
            this._scrollView = new ScrollView({
                positioning: 'relative',
                layout: {},
                layerTag: 'ul',
                childViews: optionViews,
            }),
        ];
    },

    hide: function () {
        const parent = this.get( 'parentView' );
        if ( parent ) {
            RunLoop.invokeInNextFrame( parent.hide, parent );
        }
    },

    hideAll: function () {
        if ( this.get( 'closeOnActivate' ) ) {
            let popOverView = this.getParent( PopOverView ) ||
                    this.get( 'parentView' ),
                parent;
            if ( popOverView ) {
                while ( parent = popOverView.get( 'parentPopOverView' ) ) {
                    popOverView = parent;
                }
                RunLoop.invokeInNextFrame( popOverView.hide, popOverView );
            }
        }
    }.on( 'button:activate' ),

    fireShortcut: function ( event ) {
        if ( !this.get( 'showFilter' ) ) {
            const key = DOMEvent.lookupKey( event );
            const handler = ViewEventsController
                .kbShortcuts.getHandlerForKey( key );
            let parent, object, method;
            if ( handler ) {
                parent = object = handler[0];
                method = handler[1];
                // Check object is child view of the menu; we want to ignore any
                // other keyboard shortcuts.
                if ( object instanceof View ) {
                    while ( parent && parent !== this ) {
                        parent = parent.get( 'parentView' );
                    }
                    if ( parent ) {
                        object[ method ]( event );
                        event.preventDefault();
                    }
                }
            }
        }
    }.on( 'keypress' ),
});

export default MenuView;
