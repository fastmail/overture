import { Class } from '../core/Core';
import '../core/Number';  // For Number#mod
import Obj from '../foundation/Object';
import '../foundation/EventTarget';  // For Function#on
import '../foundation/ObservableProps';  // For Function#observes
import ObservableArray from '../foundation/ObservableArray';
import { i18n } from '../localisation/LocaleController';

const OptionsController = Class({

    Extends: Obj,

    // eslint-disable-next-line object-shorthand
    init: function () {
        this.isFiltering = false;
        this.focused = null;
        this.selected = null;
        OptionsController.parent.constructor.apply( this, arguments );
        this.setOptions();
    },

    // ---

    search: '',

    resetSearch () {
        this.set( 'search', '' );
    },

    // ---

    setOptions () {
        const options = this.get( 'options' );
        const content = this.get( 'content' );
        const search = this.get( 'search' );
        const isFiltering = this.get( 'isFiltering' );
        const results = this.filterOptions( content, search, isFiltering );

        if ( options instanceof ObservableArray ) {
            options.set( '[]', results );
        } else {
            this.set( 'options', results );
        }
        this.checkFocus();
    },

    optionsWillChange: function () {
        this.setOptions();
    }.queue( 'before' ).observes( 'content', 'search', 'isFiltering' ),

    filterOptions ( content, search/*, isFiltering*/ ) {
        const patterns = search ?
            search.split( /\s+/ ).map( i18n.makeSearchRegExp ) :
            null;
        return patterns ? content.filter( function ( option ) {
            const name = option.get( 'name' );
            return patterns.every( function ( pattern ) {
                return pattern.test( name );
            });
        }) : Array.isArray( content ) ? content : content.get( '[]' );
    },

    // ---

    getAdjacent ( step ) {
        const options = this.get( 'options' );
        const l = options.get( 'length' );
        let i = options.indexOf( this.get( 'focused' ) );

        if ( i < 0 && step < 0 ) {
            i = l;
        }
        const current = i.mod( l );

        do {
            i = ( i + step ).mod( l );
        } while ( l &&
            !this.mayFocus( options.getObjectAt( i ) ) && i !== current );

        return options.getObjectAt( i );
    },

    focusPrevious () {
        return this.focus( this.getAdjacent( -1 ) );
    },

    focusNext () {
        return this.focus( this.getAdjacent( 1 ) );
    },

    mayFocus ( option ) {
        return !option.get( 'isDisabled' );
    },

    focus ( option ) {
        const current = this.get( 'focused' );
        if ( current !== option ) {
            if ( option && !this.mayFocus( option ) ) {
                option = null;
            }
            this.set( 'focused', option );
        }
        return this;
    },

    checkFocus: function () {
        const focused = this.get( 'focused' );
        if ( !this.get( 'isFiltering' ) ) {
            this.focus( null );
        } else if ( !focused || !this.mayFocus( focused ) ||
                !this.get( 'options' ).contains( focused ) ) {
            this.focus( null ).focusNext();
        }
    }.observes( 'isFiltering' ),

    // ---

    collapseFocused () {},
    expandFocused () {},

    selectFocused () {
        const focused = this.get( 'focused' );
        if ( focused ) {
            this.select( focused );
            this.resetSearch();
        }
    },

    // ---

    select () {},

    done: function () {
        this.set( 'isFiltering', false )
            .fire( 'done' );
    }.observes( 'selected' ),
});

export default OptionsController;
