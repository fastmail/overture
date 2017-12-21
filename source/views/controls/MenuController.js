import { Class } from '../../core/Core';
import '../../core/Number';  // For Number#mod
import Obj from '../../foundation/Object';
import '../../foundation/EventTarget';  // For Function#on
import '../../foundation/ObservableProps';  // For Function#observes
import { i18n } from '../../localisation/LocaleController';
import { lookupKey } from '../../dom/DOMEvent';
import MenuButtonView from './MenuButtonView';  // Circular but it's OK
import PopOverView from '../panels/PopOverView';

// A menu option must have:
// filter( pattern ): RegExp -> Boolean
// isFocused: Boolean
// isHidden: Boolean
// isDisabled: Boolean

const MenuController = Class({

    Extends: Obj,

    options: [],

    // --- Focus ---

    canSelect ( option ) {
        return !option.get( 'isHidden' ) && !option.get( 'isDisabled' );
    },

    focusedOption: null,

    getAdjacentOption ( step ) {
        const options = this.get( 'options' );
        const l = options.get( 'length' );
        let i = options.indexOf( this.get( 'focusedOption' ) );

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

    focusPrevious ( event ) {
        if ( event ) {
            event.preventDefault();
        }
        return this.focusOption( this.getAdjacentOption( -1 ) );
    },

    focusNext ( event ) {
        if ( event ) {
            event.preventDefault();
        }
        return this.focusOption( this.getAdjacentOption( 1 ) );
    },

    focusOption ( option ) {
        const current = this.get( 'focusedOption' );
        if ( current !== option ) {
            if ( current ) {
                current.set( 'isFocused', false );
            }
            if ( option ) {
                if ( !this.canSelect( option ) ) {
                    option = null;
                } else {
                    option.set( 'isFocused', true );
                }
            }
            this.set( 'focusedOption', option );
        }
        return this;
    },

    blurOption ( option ) {
        if ( this.get( 'focusedOption' ) === option ) {
            this.focusOption( null );
        }
        return this;
    },

    selectFocused ( event ) {
        if ( event ) {
            event.preventDefault();
        }
        const focusedOption = this.get( 'focusedOption' );
        if ( focusedOption && this.canSelect( focusedOption ) ) {
            focusedOption.activate( this );
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
        const focusedOption = this.get( 'focusedOption' );

        while ( l-- ) {
            options.getObjectAt( l ).filter( pattern );
        }
        if ( !focusedOption || !this.canSelect( focusedOption ) ) {
            this.focusOption( null ).focusNext();
        }
    }.observes( 'filter' ),

    // --- Keyboard support ---

    keyBindings: {
        Escape: 'onEscape',
        Enter: 'selectFocused',
        ArrowUp: 'focusPrevious',
        ArrowDown: 'focusNext',
        ArrowLeft: 'closeIfSub',
        ArrowRight: 'activateIfMenu',
    },

    triggerKeyBinding: function ( event ) {
        const key = lookupKey( event );
        const bindings = this.get( 'keyBindings' );
        if ( bindings[ key ] ) {
            event.stopPropagation();
            this[ bindings[ key ] ]( event, key );
        }
    }.on( 'keydown' ),

    onEscape ( event ) {
        event.preventDefault();
        const filter = this.get( 'filter' );
        if ( filter ) {
            this.set( 'filter', '' );
        } else {
            this.get( 'view' ).hide();
        }
    },

    closeIfSub () {
        const view = this.get( 'view' );
        let popOverView;
        if ( !view.get( 'showFilter' ) &&
                ( popOverView = view.getParent( PopOverView ) ) &&
                  popOverView.get( 'parentPopOverView' ) ) {
            view.hide();
        }
    },

    activateIfMenu () {
        const focusedOption = this.get( 'focusedOption' );
        if ( focusedOption &&
                focusedOption.get( 'button' ) instanceof MenuButtonView ) {
            this.selectFocused();
        }
    },
});

export default MenuController;
