/*globals define, _, WebGMEGlobal, $*/
/*jshint browser: true*/
/**
 * @author rkereskenyi / https://github.com/rkereskenyi
 * @author brollb / https://github.com/brollb
 */

define([
  "js/PanelBase/PanelBaseWithHeader",
  "js/PanelManager/IActivePanel",
  "widgets/TreeViz/TreeVizWidget",
  "./TreeVizControl",
], function (
  PanelBaseWithHeader,
  IActivePanel,
  TreeVizWidget,
  TreeVizPanelControl,
) {
  "use strict";

  const TreeVizPanel = function (layoutManager, params) {
    var options = {};
    //set properties from options
    options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = "TreeVizPanel";
    options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;

    //call parent's constructor
    PanelBaseWithHeader.apply(this, [options, layoutManager]);

    this._client = params.client;

    //initialize UI
    this._initialize();

    this.logger.debug("TreeVizPanel ctor finished");
  };

  //inherit from PanelBaseWithHeader
  _.extend(TreeVizPanel.prototype, PanelBaseWithHeader.prototype);
  _.extend(TreeVizPanel.prototype, IActivePanel.prototype);

  TreeVizPanel.prototype._initialize = function () {
    var self = this;

    //set Widget title
    this.setTitle("");

    this.widget = new TreeVizWidget(this.$el);

    this.widget.setTitle = function (title) {
      self.setTitle(title);
    };

    this.control = new TreeVizPanelControl({
      client: this._client,
      widget: this.widget,
    });

    this.onActivate();
  };

  TreeVizPanel.prototype.getSplitPanelToolbarEl = function () {
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

  TreeVizPanel.prototype.afterAppend = function () {
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
  TreeVizPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
    //apply parent's onReadOnlyChanged
    PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);

    //this._graphVizWidget.setReadOnly(isReadOnly);
  };

  TreeVizPanel.prototype.onResize = function (width, height) {
    this.logger.debug("onResize --> width: " + width + ", height: " + height);
    this.widget.onWidgetContainerResize(width, height);
  };

  TreeVizPanel.prototype.destroy = function () {
    this.control.destroy();
    this.widget.destroy();

    PanelBaseWithHeader.prototype.destroy.call(this);
    WebGMEGlobal.KeyboardManager.setListener(undefined);
    WebGMEGlobal.Toolbar.refresh();
  };

  TreeVizPanel.prototype.onActivate = function () {
    this.widget.onActivate();
    this.control.onActivate();
    WebGMEGlobal.KeyboardManager.setListener(this.widget);
    WebGMEGlobal.Toolbar.refresh();
  };

  TreeVizPanel.prototype.onDeactivate = function () {
    this.widget.onDeactivate();
    this.control.onDeactivate();
    WebGMEGlobal.KeyboardManager.setListener(undefined);
    WebGMEGlobal.Toolbar.refresh();
  };

  TreeVizPanel.prototype.getValidTypesInfo = function (/*nodeId, aspect*/) {
    return {};
  };

  return TreeVizPanel;
});
