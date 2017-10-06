import { Class } from '../../core/Core';
import '../../foundation/ComputedProps';  // For Function#property
import '../../foundation/EventTarget';  // For Function#on
import '../../foundation/ObservableProps';  // For Function#observes
import RunLoop from '../../foundation/RunLoop';  // Also Function#queue
import { bindTwoWay } from '../../foundation/Binding';
import { lookupKey } from '../../dom/DOMEvent';
import View from '../View';
import RootView from '../RootView';
import ViewEventsController from '../ViewEventsController';
import ScrollView from '../containers/ScrollView';
import PopOverView from '../panels/PopOverView';
import SearchTextView from './SearchTextView';
import MenuController from './MenuController';  // Circular but it's OK
import MenuOptionView from './MenuOptionView';  // FIXME(circular-imports)

const MenuView = Class({

    Extends: View,

    className: 'v-Menu',

    isMenuView: true,

    showFilter: false,
    closeOnActivate: true,

    didCreateLayer ( layer ) {
        MenuView.parent.didCreateLayer.call( this, layer );
        layer.addEventListener( 'mousemove', this, false );
        layer.addEventListener( 'mouseout', this, false );
    },

    willDestroyLayer ( layer ) {
        layer.removeEventListener( 'mouseout', this, false );
        layer.removeEventListener( 'mousemove', this, false );
        MenuView.parent.willDestroyLayer.call( this, layer );
    },

    didEnterDocument () {
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

    didLeaveDocument () {
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

    draw ( layer, Element, el ) {
        const controller = this.get( 'controller' );
        const MenuOptionView = this.get( 'ItemView' );
        const optionViews = this.get( 'options' ).map(
            view => new MenuOptionView( view, controller )
        );
        controller.set( 'options', optionViews );
        return [
            this.get( 'showFilter' ) ? el( 'div.v-Menu-filter', [
                this._input = new SearchTextView({
                    blurOnKeys: {},
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

    hide () {
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
            const key = lookupKey( event );
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
