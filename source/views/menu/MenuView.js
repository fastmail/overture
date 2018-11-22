import { Class } from '../../core/Core';
import '../../foundation/ComputedProps';  // For Function#property
import '../../foundation/EventTarget';  // For Function#on
import '../../foundation/ObservableProps';  // For Function#observes
import Obj from '../../foundation/Object';
import { bind } from '../../foundation/Binding';
import ObservableArray from '../../foundation/ObservableArray';
import RunLoop from '../../foundation/RunLoop';  // Also Function#queue
import { lookupKey } from '../../dom/DOMEvent';
import OptionsController from '../../selection/OptionsController';
import View from '../View';
import ViewEventsController from '../ViewEventsController';
import ScrollView from '../containers/ScrollView';
import OptionsListView from '../collections/OptionsListView';
import PopOverView from '../panels/PopOverView';
import MenuButtonView from './MenuButtonView';
import MenuFilterView from './MenuFilterView';
import MenuOptionView from './MenuOptionView';

const MenuOption = Class({

    Extends: Obj,

    // eslint-disable-next-line object-shorthand
    init: function ( button, controller ) {
        this.button = button;
        this.controller = controller;
    },

    isDisabled: function () {
        return this.get( 'button' ).get( 'isDisabled' );
    }.property().nocache(),

    name: function () {
        return this.get( 'button' ).get( 'label' );
    }.property().nocache(),
});

const MenuController = Class({

    Extends: OptionsController,

    // eslint-disable-next-line object-shorthand
    init: function ( view, content, isFiltering ) {
        this.options = new ObservableArray();
        this.view = view;
        this.content = content.map(
            button => new MenuOption( button, this )
        );
        MenuController.parent.constructor.call( this, {
            isFiltering,
        });
    },

    collapseFocused () {
        const view = this.get( 'view' );
        let popOverView;
        if ( !view.get( 'showFilter' ) &&
                ( popOverView = view.getParent( PopOverView ) ) &&
                  popOverView.get( 'parentPopOverView' ) ) {
            view.hide();
        }
    },

    expandFocused () {
        const focused = this.get( 'focused' );
        if ( focused && focused.get( 'button' ) instanceof MenuButtonView ) {
            this.selectFocused();
        }
    },

    select ( item ) {
        const button = item.get( 'button' );
        if ( button.activate ) {
            button.activate();
        }
    },

    done () {
        this.get( 'view' ).hide();
    },

    // ---

    viewMayHaveResized: function () {
        this.get( 'view' ).parentViewDidResize();
    }.queue( 'after' ).observes( 'search' ),
});

const MenuView = Class({

    Extends: View,

    className: 'v-Menu',

    isMenuView: true,
    showFilter: false,
    closeOnActivate: true,

    controller: function () {
        return new MenuController( this,
            this.get( 'options' ), this.get( 'showFilter' ) );
    }.property(),

    didEnterDocument () {
        MenuView.parent.didEnterDocument.call( this );

        const layer = this.get( 'layer' );
        layer.addEventListener( 'mousemove', this, false );
        layer.addEventListener( 'mouseout', this, false );

        return this;
    },

    didLeaveDocument () {
        const controller = this.get( 'controller' );
        const layer = this.get( 'layer' );

        if ( this.get( 'showFilter' ) ) {
            controller.set( 'search', '' );
        } else {
            controller.focus( null );
        }

        layer.removeEventListener( 'mouseout', this, false );
        layer.removeEventListener( 'mousemove', this, false );

        return MenuView.parent.didLeaveDocument.call( this );
    },

    ItemView: MenuOptionView,

    draw (/* layer, Element, el */) {
        const controller = this.get( 'controller' );
        return [
            this.filterView =
            this.get( 'showFilter' ) ?
            new MenuFilterView({
                controller,
            }) : null,
            this.scrollView = new ScrollView({
                positioning: 'relative',
                layout: {},
                childViews: [
                    new OptionsListView({
                        controller,
                        layerTag: 'ul',
                        content: bind( controller, 'options' ),
                        getViewTypeForItem: () => this.get( 'ItemView' ),
                    }),
                ],
            }),
        ];
    },

    hide () {
        const parent = this.get( 'parentView' );
        if ( parent ) {
            RunLoop.invokeInNextFrame( parent.hide, parent );
        }
    },

    buttonDidActivate: function () {
        if ( this.get( 'closeOnActivate' ) ) {
            let popOverView = this.getParent( PopOverView ) ||
                    this.get( 'parentView' );
            let parent;
            if ( popOverView ) {
                while (( parent = popOverView.get( 'parentPopOverView' ) )) {
                    popOverView = parent;
                }
                popOverView.hide();
            }
        }
    }.nextFrame().on( 'button:activate' ),

    keydown: function ( event ) {
        const key = lookupKey( event );
        const controller = this.get( 'controller' );
        switch ( key ) {
        case 'Enter':
            controller.selectFocused();
            break;
        case 'ArrowUp':
            controller.focusPrevious();
            break;
        case 'ArrowDown':
            controller.focusNext();
            break;
        case 'ArrowLeft':
            if ( !controller.collapseFocused() ) {
                return;
            }
            break;
        case 'ArrowRight':
            if ( !controller.expandFocused() ) {
                return;
            }
            break;
        default:
            if ( !this.get( 'showFilter' ) ) {
                const handler = ViewEventsController
                    .kbShortcuts.getHandlerForKey( key );
                let parent, object, method;
                if ( handler ) {
                    parent = object = handler[0];
                    method = handler[1];
                    // Check object is child view of the menu; we want to
                    // ignore any other keyboard shortcuts.
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
            return;
        }
        event.preventDefault();
    }.on( 'keydown' ),
});

export default MenuView;
