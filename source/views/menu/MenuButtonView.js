import { Class } from '../../core/Core';
import '../../foundation/ComputedProps';  // For Function#property
import '../../foundation/EventTarget';  // For Function#on
import '../../foundation/ObservableProps';  // For Function#observes
import PopOverView from '../panels/PopOverView';
import RootView from '../RootView';
import ButtonView from '../controls/ButtonView';
import MenuOptionView from './MenuOptionView';

/**
    Class: O.MenuButtonView

    Extends: O.ButtonView

    A MenuButtonView reveals a menu when pressed. Example usage:

        new O.MenuButtonView({
            label: 'Select File',
            popOverView: new O.PopOverView(),
            menuView: new O.MenuView({
                showFilter: false,
                closeOnActivate: true,
                options: [
                    new O.FileButtonView({
                        label: 'Upload From Computer',
                        acceptMultiple: true,
                        target: controller,
                        method: 'uploadFiles'
                    }),
                    new O.ButtonView({
                        label: 'Select From Dropbox',
                        target: controller,
                        method: 'selectFromDropbox'
                    })
                ]
            })
        });
*/
const MenuButtonView = Class({

    Extends: ButtonView,

    /**
        Property: O.MenuButtonView#type
        Type: String
        Default: 'v-MenuButton'

        Overrides default in <O.ButtonView#type>.
    */
    type: 'v-MenuButton',

    /**
        Property: O.MenuButtonView#popOverView
        Type: O.PopOverView

        The <O.PopOverView> instance to use to show the menu view.
    */
    popOverView: null,

    /**
        Property: O.MenuButtonView#popOverViewOptions
        Type: Object

        Options to pass to <O.PopOverView#show>.
    */
    popOverOptions: {},

    /**
        Property: O.MenuButtonView#menuView
        Type: O.MenuView

        The <O.MenuView> instance to show when the button is pressed.
    */
    menuView: null,

    /**
        Property: O.MenuButtonView#destroyMenuViewOnClose
        Type: Boolean

        If the menu view is regenerated each time it is opened, set this to
        true to destroy the view when the pop over is closed.
    */
    destroyMenuViewOnClose: false,

    /**
        Property: O.MenuButtonView#alignMenu
        Type: String
        Default: 'left'

        Which of the menu and button edges should be aligned? Valid options are
        'left', 'right' or 'centre'.
    */
    alignMenu: 'left',

    /**
        Property: O.MenuButtonView#isInMenu
        Type: Boolean

        Is this a child view of an <O.MenuOptionView>?
    */
    isInMenu: function () {
        return this.get( 'parentView' ) instanceof MenuOptionView;
    }.property( 'parentView' ),

    // --- Accessibility ---

    didCreateLayer ( layer ) {
        layer.setAttribute( 'aria-expanded', 'false' );
    },

    ariaNeedsRedraw: function ( self, property, oldValue ) {
        return this.propertyNeedsRedraw( self, 'aria', oldValue );
    }.observes( 'isActive' ),

    redrawAria ( layer ) {
        // Set ARIA attribute to link the menu DOM element to this
        // button, so screen readers know what has opened.
        layer.setAttribute( 'aria-controls',
            this.getFromPath( 'menuView.id' ) );
        // And set ARIA attribute to say that the menu is now open
        layer.setAttribute( 'aria-expanded', this.get( 'isActive' ) + '' );
    },

    // --- Activate ---

    /**
        Method: O.MenuButtonView#activate

        Overridden to show menu associated with button, if not already visible.
        Ignores target/method/action properties.
    */
    activate () {
        if ( !this.get( 'isActive' ) && !this.get( 'isDisabled' ) ) {
            this.set( 'isActive', true );
            const buttonView = this;
            const menuView = this.get( 'menuView' );
            let popOverView, menuOptionView;
            const popOverOptions = Object.assign({
                view: menuView,
                alignWithView: buttonView,
                alignEdge: this.get( 'alignMenu' ),
                onHide () {
                    buttonView.set( 'isActive', false );
                    if ( menuOptionView ) {
                        menuOptionView.removeObserverForKey(
                            'isFocused', popOverView, 'hide' );
                    }
                    if ( buttonView.get( 'destroyMenuViewOnClose' ) ) {
                        menuView.destroy();
                    }
                },
            }, this.get( 'popOverOptions' ) );
            if ( this.get( 'isInMenu' ) ) {
                popOverView = this.getParent( PopOverView );
                const preferLeft =
                    popOverView.get( 'options' ).positionToThe === 'left';
                const rootViewWidth =
                    this.getParent( RootView ).get( 'pxWidth' );
                const position = this.get( 'layer' ).getBoundingClientRect();
                menuOptionView = this.get( 'parentView' );
                popOverOptions.alignWithView = popOverView;
                popOverOptions.atNode = this.get( 'layer' );
                popOverOptions.positionToThe =
                    preferLeft &&
                        position.left > position.width ?
                        'left' :
                    !preferLeft &&
                        rootViewWidth - position.right > position.width ?
                        'right' :
                    position.left < rootViewWidth - position.right ?
                        'right' : 'left';
                popOverOptions.keepInHorizontalBounds = true;
                popOverOptions.showCallout = false;
                popOverOptions.alignEdge = 'top';
                popOverOptions.offsetTop =
                    popOverOptions.view.get( 'showFilter' ) ? -35 : -5;
                popOverOptions.offsetLeft = 0;
            } else {
                popOverView = this.get( 'popOverView' );
            }
            // If the isInMenu, the popOverView used will actually be a subview
            // of this popOverView, and is returned from the show method.
            popOverView = popOverView.show( popOverOptions );
            if ( menuOptionView ) {
                menuOptionView.get( 'controller' ).addObserverForKey(
                    'focused', popOverView, 'hide' );
            }
        }
    },

    // --- Keep state in sync with render ---

    /**
        Method (private): O.MenuButtonView#_activateOnMousedown

        Activates the button on mousedown, not just on click. This allows the
        user to press the mouse down on the button to show the menu, drag down
        to the option they want, then release the button to select it.
    */
    _activateOnMousedown: function ( event ) {
        if ( event.button || event.metaKey || event.ctrlKey ) {
            return;
        }
        this.activate();
    }.on( 'mousedown' ),
});

export default MenuButtonView;
