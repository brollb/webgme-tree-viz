/*globals define, _, WebGMEGlobal, $*/
/*jshint browser: true*/
/**
 * @author rkereskenyi / https://github.com/rkereskenyi
 * @author brollb / https://github.com/brollb
 */

define([
  "js/PanelBase/PanelBaseWithHeader",
  "js/PanelManager/IActivePanel",
  "widgets/GraphViz/GraphVizWidget",
  "./GraphVizControl",
], function (
  PanelBaseWithHeader,
  IActivePanel,
  GraphVizWidget,
  GraphVizPanelControl,
) {
  "use strict";

  const GraphVizPanel = function (layoutManager, params) {
    var options = {};
    //set properties from options
    options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = "GraphVizPanel";
    options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;

    //call parent's constructor
    PanelBaseWithHeader.apply(this, [options, layoutManager]);

    this._client = params.client;

    //initialize UI
    this._initialize();

    this.logger.debug("GraphVizPanel ctor finished");
  };

  //inherit from PanelBaseWithHeader
  _.extend(GraphVizPanel.prototype, PanelBaseWithHeader.prototype);
  _.extend(GraphVizPanel.prototype, IActivePanel.prototype);

  GraphVizPanel.prototype._initialize = function () {
    var self = this;

    //set Widget title
    this.setTitle("");

    this.widget = new GraphVizWidget(this.$el);

    this.widget.setTitle = function (title) {
      self.setTitle(title);
    };

    this.control = new GraphVizPanelControl({
      client: this._client,
      widget: this.widget,
    });

    this.onActivate();
  };

  GraphVizPanel.prototype.getSplitPanelToolbarEl = function () {
    this._splitPanelToolbarEl = IActivePanel.prototype.getSplitPanelToolbarEl
      .call(this);

    // Set the size bigger than 40 x 40 and add some padding for the scroll-bar.
    this._splitPanelToolbarEl.css({
      width: "100px",
      height: "100px",
      "padding-right": "10px",
    });

    this.control._addSplitPanelToolbarBtns(this._splitPanelToolbarEl);

    return this._splitPanelToolbarEl;
  };

  GraphVizPanel.prototype.afterAppend = function () {
    PanelBaseWithHeader.prototype.afterAppend.call(this);
    // At this point the split-panel has added its buttons (the maximize)
    // and we can modify the look of all btns.

    this._splitPanelToolbarEl.children().each(function () {
      $(this).css({
        "font-size": "16px",
      });
    });
  };

  /* OVERRIDE FROM WIDGET-WITH-HEADER */
  /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
  GraphVizPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
    //apply parent's onReadOnlyChanged
    PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);

    //this._graphVizWidget.setReadOnly(isReadOnly);
  };

  GraphVizPanel.prototype.onResize = function (width, height) {
    this.logger.debug("onResize --> width: " + width + ", height: " + height);
    this.widget.onWidgetContainerResize(width, height);
  };

  GraphVizPanel.prototype.destroy = function () {
    this.control.destroy();
    this.widget.destroy();

    PanelBaseWithHeader.prototype.destroy.call(this);
    WebGMEGlobal.KeyboardManager.setListener(undefined);
    WebGMEGlobal.Toolbar.refresh();
  };

  GraphVizPanel.prototype.onActivate = function () {
    this.widget.onActivate();
    this.control.onActivate();
    WebGMEGlobal.KeyboardManager.setListener(this.widget);
    WebGMEGlobal.Toolbar.refresh();
  };

  GraphVizPanel.prototype.onDeactivate = function () {
    this.widget.onDeactivate();
    this.control.onDeactivate();
    WebGMEGlobal.KeyboardManager.setListener(undefined);
    WebGMEGlobal.Toolbar.refresh();
  };

  GraphVizPanel.prototype.getValidTypesInfo = function (/*nodeId, aspect*/) {
    return {};
  };

  return GraphVizPanel;
});
