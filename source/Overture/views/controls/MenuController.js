import { Class } from '../../core/Core.js';
import '../../core/Number.js';  // For Number#mod
import Object from '../../foundation/Object.js';
import '../../foundation/EventTarget.js';  // For Function#on
import '../../foundation/ObservableProps.js';  // For Function#observes
import { i18n } from '../../localisation/LocaleController.js';
import DOMEvent from '../../dom/DOMEvent.js';
import MenuButtonView from './MenuButtonView.js';
import PopOverView from '../panels/PopOverView.js';

// A menu option must have:
// filter( pattern ): RegExp -> Boolean
// isFocussed: Boolean
// isHidden: Boolean
// isDisabled: Boolean

const MenuController = Class({

    Extends: Object,

    options: [],

    // --- Focus ---

    canSelect: function ( option ) {
        return !option.get( 'isHidden' ) && !option.get( 'isDisabled' );
    },

    focussedOption: null,

    getAdjacentOption: function ( step ) {
        const options = this.get( 'options' );
        const l = options.get( 'length' );
        let i = options.indexOf( this.get( 'focussedOption' ) );

        if ( i < 0 && step < 0 ) {
            i = l;
        }
        const current = i.mod( l );

        do {
            i = ( i + step ).mod( l );
        } while ( l &&
            !this.canSelect( options.getObjectAt( i ) ) && i !== current );

        return options.getObjectAt( i );
    },

    focusPrevious: function ( event ) {
        if ( event ) { event.preventDefault(); }
        return this.focusOption( this.getAdjacentOption( -1 ) );
    },

    focusNext: function ( event ) {
        if ( event ) { event.preventDefault(); }
        return this.focusOption( this.getAdjacentOption( 1 ) );
    },

    focusOption: function ( option ) {
        const current = this.get( 'focussedOption' );
        if ( current !== option ) {
            if ( current ) {
                current.set( 'isFocussed', false );
            }
            if ( option ) {
                if ( !this.canSelect( option ) ) {
                    option = null;
                } else {
                    option.set( 'isFocussed', true );
                }
            }
            this.set( 'focussedOption', option );
        }
        return this;
    },

    blurOption: function ( option ) {
        if ( this.get( 'focussedOption' ) === option ) {
            this.focusOption( null );
        }
        return this;
    },

    selectFocussed: function ( event ) {
        if ( event ) { event.preventDefault(); }
        const focussedOption = this.get( 'focussedOption' );
        if ( focussedOption && this.canSelect( focussedOption ) ) {
            focussedOption.activate( this );
        }
        return this;
    },

    // --- Filter ---

    filter: '',

    filterDidChange: function () {
        const value = this.get( 'filter' );
        const pattern = value ? i18n.makeSearchRegExp( value ) : null;
        const options = this.get( 'options' );
        let l = options.get( 'length' );
        const focussedOption = this.get( 'focussedOption' );

        while ( l-- ) {
            options.getObjectAt( l ).filter( pattern );
        }
        if ( !focussedOption || !this.canSelect( focussedOption ) ) {
            this.focusOption( null ).focusNext();
        }
    }.observes( 'filter' ),

    // --- Keyboard support ---

    keyBindings: {
        esc: 'onEscape',
        enter: 'selectFocussed',
        up: 'focusPrevious',
        down: 'focusNext',
        left: 'closeIfSub',
        right: 'activateIfMenu',
    },

    triggerKeyBinding: function ( event ) {
        const key = DOMEvent.lookupKey( event );
        const bindings = this.get( 'keyBindings' );
        if ( bindings[ key ] ) {
            event.stopPropagation();
            this[ bindings[ key ] ]( event, key );
        }
    }.on( 'keydown' ),

    onEscape: function ( event ) {
        event.preventDefault();
        const filter = this.get( 'filter' );
        if ( filter ) {
            this.set( 'filter', '' );
        } else {
            this.get( 'view' ).hide();
        }
    },

    closeIfSub: function () {
        const view = this.get( 'view' );
        let popOverView;
        if ( !view.get( 'showFilter' ) &&
                ( popOverView = view.getParent( PopOverView ) ) &&
                  popOverView.get( 'parentPopOverView' ) ) {
            view.hide();
        }
    },

    activateIfMenu: function () {
        const focussedOption = this.get( 'focussedOption' );
        if ( focussedOption &&
                focussedOption.get( 'button' ) instanceof MenuButtonView ) {
            this.selectFocussed();
        }
    },
});

export default MenuController;
