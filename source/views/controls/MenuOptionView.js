import { Class } from '../../core/Core';
import '../../foundation/ComputedProps';  // For Function#property
import '../../foundation/EventTarget';  // For Function#on
import '../../foundation/ObservableProps';  // For Function#observes
import RunLoop from '../../foundation/RunLoop';
import View from '../View';
import ScrollView from '../containers/ScrollView';
import PopOverView from '../panels/PopOverView';
import MenuView from './MenuView';  // Circular but it's OK

const MenuOptionView = Class({

    Extends: View,

    isHidden: false,
    isDisabled: function () {
        return this.getFromPath( 'button.isDisabled' );
    }.property( 'button.isDisabled' ),
    isFocused: false,
    isFocussable: function () {
        return !this.get( 'isHidden' ) && !this.get( 'isDisabled' );
    }.property( 'isHidden', 'isDisabled' ),

    layerTag: 'li',

    className: function () {
        return 'v-MenuOption' +
            ( this.get( 'isFocused' ) ? ' is-focused' : '' ) +
            ( this.get( 'isHidden' ) ? ' u-hidden' : '' );
    }.property( 'isFocused', 'isHidden' ),

    init ( view, controller ) {
        this.childViews = [ view ];
        this.button = view;
        this.controller = controller;
        MenuOptionView.parent.constructor.call( this );
    },

    scrollIntoView: function () {
        if ( this.get( 'isFocused' ) ) {
            const scrollView = this.getParent( ScrollView );
            if ( scrollView ) {
                const scrollHeight = scrollView.get( 'pxHeight' );
                const scrollTop = scrollView.get( 'scrollTop' );
                const top = this.getPositionRelativeTo( scrollView ).top;
                const height = this.get( 'pxHeight' );

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
    }.observes( 'isFocused' ),

    _focusTimeout: null,

    takeFocus () {
        if ( this.get( 'isInDocument' ) ) {
            this.get( 'controller' ).focusOption( this )
                .activateIfMenu();
        }
    },

    mouseMove: function () {
        if ( !this.get( 'isFocused' ) && !this._focusTimeout ) {
            const popOverView = this.getParent( PopOverView );
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

    filter ( pattern ) {
        const label = this.get( 'button' ).get( 'label' );
        this.set( 'isHidden', !!pattern && !pattern.test( label ) );
    },

    activate () {
        const button = this.get( 'button' );
        if ( button.activate ) {
            button.activate();
        }
    },
});

export default MenuOptionView;
