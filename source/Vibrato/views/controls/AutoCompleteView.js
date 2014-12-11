// -------------------------------------------------------------------------- \\
// File: AutoCompleteView.js                                                  \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, MenuView.js                         \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var AutoCompleteSource = NS.Class({

    Extends: NS.Object,

    maxResults: 10,
    suggestions: [],

    getTestFn: function ( value ) {
        var regexp = new RegExp( '(?:^|\\W)' + value.escapeRegExp(), 'i' );
        return regexp.test.bind( regexp );
    },
    renderSuggestion: function ( suggestion, current ) {
        return suggestion.escapeHTML();
    },
    acceptSuggestion: function ( suggestion, current ) {
        return suggestion;
    }
});

var AutoCompleteController = NS.Class({

    Extends: NS.MenuController,

    init: function ( mixin ) {
        AutoCompleteController.parent.init.call( this, mixin );
        this.setOptions();
        this.filterDidChange();
    },

    setOptions: function () {
        var options = this.getFromPath( 'view.collection.childViews' );
        this.set( 'options', options ? options.slice() : [] );
    }.observes( 'view.collection.childViews' ),

    selectFirst: function ( _, __, ___, options ) {
        this.focusOption( options[0] || null );
    }.observes( 'options' ),

    suggestions: function () {
        return new NS.ObservableArray();
    }.property(),

    filter: NS.bind( 'view.inputView.value' ),
    filterDidChange: function () {
        var value = this.get( 'filter' ) || '',
            sources = this.getFromPath( 'view.sources' ),
            items = [],
            i, l, source, count, max, suggestions, accept,
            j, m, suggestion;

        if ( value.length >= this.getFromPath( 'view.minChars' ) ) {
            for ( i = 0, l = sources.length; i < l; i += 1 ) {
                source = sources[i];
                count = 0;
                max = source.get( 'maxResults' );
                suggestions = source.get( 'suggestions' );
                accept = source.getTestFn( value );

                for ( j = 0, m = suggestions.get( 'length' );
                        j < m && count < max; j += 1 ) {
                    if ( accept( suggestion = suggestions.getObjectAt( j ) ) ) {
                        items.push({
                            controller: this,
                            source: source,
                            suggestion: suggestion,
                            current: value
                        });
                        count += 1;
                    }
                }
            }
        }

        this.get( 'suggestions' ).set( '[]', items );
    }.observes( 'filter' ),

    keyBindings: {
        tab: 'selectFocussed',
        enter: 'selectFocussed',
        up: 'focusPrevious',
        down: 'focusNext'
    }
});

var AutoCompleteOptionView = NS.Class({

    Extends: NS.View,

    isFocussed: false,
    isFocussable: true,

    layerTag: 'li',

    className: function () {
        return 'AutoCompleteOptionView' +
            ( this.get( 'isFocussed' ) ? ' focussed' : '' );
    }.property( 'isFocussed' ),

    takeFocus: function () {
        this.get( 'content' ).controller.focusOption( this );
    }.on( 'mousemove' ),

    loseFocus: function () {
        this.get( 'content' ).controller.blurOption( this );
    }.on( 'mouseout' ),

    draw: function ( layer, Element, el ) {
        var content = this.get( 'content' ),
            source = content.source,
            suggestion = content.suggestion,
            current = content.current;
        layer.innerHTML = source.renderSuggestion( suggestion, current );
    },

    activate: function () {
        var content = this.get( 'content' ),
            inputView = content.controller.getFromPath( 'view.inputView' ),
            current = inputView.get( 'value' ),
            result = content.source.acceptSuggestion(
                content.suggestion, current );

        if ( result !== current ) {
            inputView
                .set( 'value', result )
                .set( 'selection', { start: result.length } );
        }
    },

    activateOnClick: function ( event ) {
        event.preventDefault();
        this.activate();
    }.on( 'mousedown', 'tap' )
});

var AutoCompleteView = NS.Class({

    Extends: NS.MenuView,

    isActive: false,
    hasSuggestions: NS.bind( 'controller.suggestions*length',
        null, NS.Transform.toBoolean ),

    minChars: 1,
    sources: [],

    controller: function () {
        return new AutoCompleteController({
            view: this
        });
    }.property(),

    // ---

    init: function ( mixin ) {
        AutoCompleteView.parent.init.call( this, mixin );
        var view = this.get( 'inputView' ),
            _;
        if ( view ) {
            this.inputViewDidChange( _, _, _, view );
        }
    },

    inputView: null,
    inputViewDidChange: function ( _, __, oldView, newView ) {
        if ( oldView ) {
            oldView.off( 'focus', this, 'inputDidReceiveFocus' );
            oldView.off( 'blur', this, 'inputDidLoseFocus' );
            oldView.off( 'keydown', this, 'inputDidKeydown' );
        }
        if ( newView ) {
            newView.on( 'focus', this, 'inputDidReceiveFocus' );
            newView.on( 'blur', this, 'inputDidLoseFocus' );
            newView.on( 'keydown', this, 'inputDidKeydown' );
            if ( newView.get( 'isFocussed' ) ) {
                this.inputDidReceiveFocus();
            }
        }
    }.observes( 'inputView' ),

    inputDidReceiveFocus: function () {
        this.set( 'isActive', true );
    },
    inputDidLoseFocus: function () {
        this.set( 'isActive', false );
    },
    inputDidKeydown: function ( event ) {
        if ( this.get( 'isActive' ) && this.get( 'hasSuggestions' ) ) {
            this.get( 'controller' ).triggerKeyBinding( event );
        }
    },

    // ---

    collection: null,

    ItemView: AutoCompleteOptionView,

    className: function () {
        return this.get( 'isActive' ) && this.get( 'hasSuggestions' ) ?
            'AutoCompleteView' : 'u-hidden';
    }.property( 'isActive', 'hasSuggestions' ),

    positioning: 'absolute',

    draw: function ( layer, Element, el ) {
        var collection = new NS.ListView({
            content: this.get( 'controller' ).get( 'suggestions' ),
            layerTag: 'ul',
            ItemView: this.get( 'ItemView' )
        });
        this.set( 'collection', collection );
        return collection;
    },

    fireShortcut: function () {}
});

NS.AutoCompleteSource = AutoCompleteSource;
NS.AutoCompleteController = AutoCompleteController;
NS.AutoCompleteOptionView = AutoCompleteOptionView;
NS.AutoCompleteView = AutoCompleteView;

}( this.O ) );
