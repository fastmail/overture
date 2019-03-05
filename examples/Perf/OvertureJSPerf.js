/*  Perf – OvertureJS Example App

    It is based on the comparison app from:
    https://www.codementor.io/reactjs/tutorial/reactjs-vs-angular-js-performance-comparison-knockout

    © 2015 FastMail Pty Ltd. MIT Licensed.
*/

/*global O */

"use strict";

var el = O.Element.create;

/*  A factory function to create the necessary OvertureJS app state and views.
*/
function overturePerf ( options ) {

	// --- Namespace ---

    /*  'App' namespace to hold the state and model.
    */
    var App = new O.Object({
        data: new O.ObservableArray(),
        selectedItem: null,
    });

	// --- Views ---

    /*  A custom view for each item in the data.
    */
    var DataItemView = O.Class({

        Extends: O.ListItemView,

        itemHeight: options.itemHeight,

        className: 'row',

        positioning: 'static',
        layout: {},

        /*  Dynamic property to determine if data item is selected.
        */
        isSelected: function () {
            return App.selectedItem === this;
        }.property().nocache(),

        /*  Display the item.
        */
        draw: function ( layer ) {
            var item = this.get( 'content' );
            return [
                el( 'div.col-md-12.test-data', [
                    el( 'span', [ item.label ] )
                ])
            ];
        },

		// --- Actions ---

        /*  Select this item when clicked.
        */
        select: function ( event ) {
            if ( !this.get( 'isSelected' ) ) {
            	// Deselect any existing item.
                if ( App.selectedItem ) {
                    App.selectedItem.set( 'className', 'row' );
                }
                App.set( 'selectedItem', this );
                this.set( 'className', 'row selected' );
            }

            /*  Stop propagation so the click handler on the
                root view isn't triggered.
            */
            event.stopPropagation();
        }.on( 'click' )
    });

    /*  Custom view for each item in the data using a bound property for
        selection - a little slower.
    */
    var BoundDataItemView = O.Class({

        Extends: O.ListItemView,

        itemHeight: options.itemHeight,

        /*  Bound property for determining selection status.
        */
        isSelected: O.bind( App, 'selectedItem',
        function ( record ) {
            return this.toObject.get( 'content' ) === record;
        }),

        /*  Dynamic property for determining the class.
        */
        className: function() {
            return 'row' + ( this.get( 'isSelected' ) ? ' selected' : '' );
        }.property( 'isSelected' ),

        draw: DataItemView.prototype.draw,

        /*  Select just sets the selected item on the controller.
        */
        select: function ( event ) {
            /*  The selected item should be the data, not the view.
                In progressive rendering, the view may be destroyed
                and recreated for the same content, but it's the
                content that stays selected.
            */
            App.set( 'selectedItem', this.get( 'content' ) );
            event.stopPropagation();
        }.on( 'click' )
    });

    /*  Define the default mixin params for the list view.
    */
    var listViewMixin = {
        className: 'overture-listView',
        content: App.data,
        ItemView: options.useBound ? BoundDataItemView : DataItemView
    };

    /*  Add the supplied params.
    */
    O.mixin( listViewMixin, options.listViewOptions );

    /*  A view class for the full OvertureJS column - needs to have an
        accurate visibleRect for scrolling when using progressive.
    */
    var DataView = O.Class({

        Extends: O.View,

        /*  Pass through the parent view visible rect,
            since this view should fill the parent.
        */
        visibleRect: function () {
            return this.getFromPath( 'parentView.visibleRect' );
        }.property( 'parentView.visibleRect' )
    });

    /*  Create the top level view.
    */
    var view = new DataView({
        id: options.name + '-application',

        labelValue: 'Run',

        drawStartTime: null,

        /*  Display the header, items, etc.
        */
        draw: function ( layer ) {
            return [
                el( 'div.row', [
                    el( 'div.col-md-8', [
                        el( 'h3', [
                            options.name,
                        ]),
                    ])                                                                                                                                                                                                                                                                       ,
                    new O.LabelView({
                        layerTag: 'div',
                        id: options.name + '-run',
                        className: 'col-md-4 text-right time',
                        value: new O.Binding({
                            isTwoWay: true
                        }).from( 'labelValue', this ),

                        /*  Handle the run command.
                        */
                        run: function ( event ) {
                            this.set( 'value', 'Running' );
                            var data = _buildData();
                            this.get( 'parentView' ).set(
                                'drawStartTime', new Date() );
                            App.data.set( '[]', data );
                            this.updateTime();
                        }.on( 'click' ),

                        /*  Helper to update the run time.
                            Injected into the runLoop after rendering completed.
                        */
                        updateTime: function () {
                            var view = this.get( 'parentView' );
                            if ( view.get( 'drawStartTime' ) ) {
                                view.set( 'labelValue', '' + ( new
                                    Date() - view.get(
                                    'drawStartTime' ) ) + ' ms' );
                            }
                        }.queue( 'after' )
                    })
                ]),
                /*  Instantiate the specified list view class here
                    using the specified params.
                */
                new options.listViewClass( listViewMixin )
            ];
        }
    });

    /*  Instatiate the specified root view attached to the specified target.
    */
    var targetElem = document.getElementById( options.target );
    return new options.rootViewClass( targetElem ).insertView( view );
}

/*  Fixed height for each item.
*/
var itemHeight = 29;

/*  Create the 'naive' OvertureJS implementation.
*/
var naiveRootView = overturePerf({
    name: 'OvertureJS',
    target: 'overture-naive',
    listViewClass: O.ListView,
    listViewOptions: {},
    rootViewClass: O.RootView,
    itemHeight: itemHeight,
    useBound: false
});

/*  To function correctly in the existing test framework we use a custom root
    view to calculate the scroll position and height correctly.
    This would not be required in an OvertureJS-only app.
*/
var ScrollingRootView = O.Class({

    Extends: O.RootView,

    pxHeight: function () {
        return window.innerHeight;
    }.property(),

    _onScroll: function ( event ) {
        var layer = this.get( 'layer' ),
            doc = layer.ownerDocument,
            win = doc.defaultView,
            html = doc.documentElement,
            // pageXOffset for everything but IE8.
            left = win.pageXOffset || html.scrollLeft || 0,
            // pageYOffset for everything but IE8.
            top = win.pageYOffset || html.scrollTop || 0;
        this.beginPropertyChanges()
                .set( 'scrollLeft', left )
                .set( 'scrollTop', top )
            .endPropertyChanges();
        event.stopPropagation();
    }.on( 'scroll' )
});

/*  Somewhat arbitrary batch size for on-demand loading,
    not critical for local only data sources.
*/
var batchSize = 50;

/*  Create an OvertureJS implementation using a progressive view for a more
    realistic use-case and *much* better performance.
    Note that it only requires a different list view and some additional
    params to work in the existing test framework.
    As noted above, in this scenario it also requires a custom
    root view to calculate the scroll position correctly,
    but this would not be required in an OvertureJS-only app.
*/
var progressiveRootView = overturePerf({
    name: 'OvertureJS+',
    target: 'overture-progressive',
    listViewClass: O.ProgressiveListView,
    listViewOptions: {
        batchSize: batchSize,
        itemHeight: itemHeight,
    },
    rootViewClass: ScrollingRootView,
    itemHeight: itemHeight,
    /*  We need the bound version so we don't lose selection when we scroll
        the progressive away from the selected item and back.
    */
    useBound: true
});
