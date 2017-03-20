// -------------------------------------------------------------------------- \\
// File: MenuOptionView.js                                                    \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, ContainerViews, PanelViews, MenuView.js \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../../core/Core.js';
import '../../foundation/ComputedProps.js';  // For Function#property
import '../../foundation/EventTarget.js';  // For Function#on
import '../../foundation/ObservableProps.js';  // For Function#observes
import RunLoop from '../../foundation/RunLoop.js';
import View from '../View.js';
import ScrollView from '../containers/ScrollView.js';
import PopOverView from '../panels/PopOverView.js';
import MenuView from './MenuView.js';

var MenuOptionView = Class({

    Extends: View,

    isHidden: false,
    isDisabled: function () {
        return this.getFromPath( 'button.isDisabled' );
    }.property( 'button.isDisabled' ),
    isFocussed: false,
    isFocussable: function () {
        return !this.get( 'isHidden' ) && !this.get( 'isDisabled' );
    }.property( 'isHidden', 'isDisabled' ),

    layerTag: 'li',

    className: function () {
        return 'v-MenuOption' +
            ( this.get( 'isFocussed' ) ? ' is-focussed' : '' ) +
            ( this.get( 'isHidden' ) ? ' u-hidden' : '' );
    }.property( 'isFocussed', 'isHidden' ),

    init: function ( view, controller ) {
        this.childViews = [ view ];
        this.button = view;
        this.controller = controller;
        MenuOptionView.parent.init.call( this );
    },

    scrollIntoView: function () {
        if ( this.get( 'isFocussed' ) ) {
            var scrollView = this.getParent( ScrollView );
            if ( scrollView ) {
                var scrollHeight = scrollView.get( 'pxHeight' ),
                    scrollTop = scrollView.get( 'scrollTop' ),
                    top = this.getPositionRelativeTo( scrollView ).top,
                    height = this.get( 'pxHeight' );

                if ( top < scrollTop ) {
                    scrollView.scrollTo( 0, top - ( height >> 1 ), true );
                } else if ( top + height > scrollTop + scrollHeight ) {
                    scrollView.scrollTo( 0,
                        top + height - scrollHeight + ( height >> 1 ), true );
                }
            }
            if ( !this.getParent( MenuView ).get( 'showFilter' ) ) {
                this.button.focus();
            }
        }
    }.observes( 'isFocussed' ),

    _focusTimeout: null,

    takeFocus: function () {
        if ( this.get( 'isInDocument' ) ) {
            this.get( 'controller' ).focusOption( this )
                .activateIfMenu();
        }
    },

    mouseMove: function () {
        if ( !this.get( 'isFocussed' ) && !this._focusTimeout ) {
            var popOverView = this.getParent( PopOverView );
            if ( popOverView && popOverView.hasSubView() ) {
                this._focusTimeout = RunLoop.invokeAfterDelay(
                    this.takeFocus, 75, this );
            } else {
                this.takeFocus();
            }
        }
    }.on( 'mousemove' ),

    mouseOut: function () {
        if ( this._focusTimeout ) {
            RunLoop.cancel( this._focusTimeout );
            this._focusTimeout = null;
        }
        if ( !this.get( 'button' ).get( 'isActive' ) ) {
            this.get( 'controller' ).blurOption( this );
        }
    }.on( 'mouseout' ),

    filter: function ( pattern ) {
        var label = this.get( 'button' ).get( 'label' );
        this.set( 'isHidden', !!pattern && !pattern.test( label ) );
    },

    activate: function () {
        var button = this.get( 'button' );
        if ( button.activate ) { button.activate(); }
    },
});

export default MenuOptionView;
