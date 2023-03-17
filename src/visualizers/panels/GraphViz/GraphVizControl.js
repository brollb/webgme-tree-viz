/*globals define, _, WebGMEGlobal, $*/
/*jshint browser: true*/
/**
 * @author rkereskenyi / https://github.com/rkereskenyi
 * @author nabana / https://github.com/nabana
 */

define([
  "js/logger",
  "webgme-graph-viz/utils",
  "webgme-transformations/src/common/index",  // FIXME: remove src/common
  "js/Constants",
  "js/Utils/GMEConcepts",
  "js/NodePropertyNames",
  "underscore",
], function (
    Logger,
    utils,
    GMETransformations,
    CONSTANTS,
    GMEConcepts,
    nodePropertyNames,
    _
) {
  "use strict";

  console.log({GMETransformations});
  const {TransformationObserver} = GMETransformations;
  const SET_NAME = "visualizers";
  const ENGINE_NAME = "GraphViz";

  var GraphVizControl;

  GraphVizControl = function (options) {
    this._logger = Logger.create(
      "gme:Panels:GraphViz:GraphVizControl",
      WebGMEGlobal.gmeConfig.client.log,
    );

    this._client = options.client;

    //initialize core collections and variables
    this._graphVizWidget = options.widget;
    this._transformObs = new TransformationObserver(
      this._client,
      core => new DefaultTransformation(core),
      async viewModel => {
        //const isNodeStillActive = (nodeId) => nodeId === this._currentNodeId;
        // resolve the metamodel nodes to their names
        const {core, rootNode} = await this.getCoreInstance();
        const metanodes = core.getLibraryMetaNodes(rootNode, ENGINE_NAME);
        const libraryMeta = new NodePathResolver(core, metanodes);
        viewModel = viewModel.map(node => libraryMeta.resolveType(node));

        console.log({viewModel});
        const data = viewModel.map((node) => this._getObjectDescriptor(node, libraryMeta));
        console.log("set data to", data);
        this._graphVizWidget.setData(data[0]);
      }
    );
    this._currentNodeId = null;
    this._currentNodeParentId = undefined;

    this._displayModelsOnly = false;

    this._initWidgetEventHandlers();

    this._logger.debug("Created");
  };

  GraphVizControl.prototype._initWidgetEventHandlers = function () {
    var self = this;

    this._graphVizWidget.onBackgroundDblClick = function () {
      if (self._currentNodeParentId) {
        WebGMEGlobal.State.registerActiveObject(self._currentNodeParentId);
      }
    };

    this._graphVizWidget.onNodeDblClick = function (id) {
      WebGMEGlobal.State.registerActiveObject(id);
    };

    this._graphVizWidget.onExtendMenuItems = (nodeId, menuItems) => {
      return this.onExtendMenuItems(nodeId, menuItems);
    };

    this._graphVizWidget.deleteNode = (nodeId) => {
      this._client.deleteNode(nodeId);
    };

    this._graphVizWidget.setName = (nodeId, name) => {
      this._client.setAttribute(nodeId, "name", name);
    };

    this._graphVizWidget.onNodeOpen = function (id) {
      //self._selfPatterns[id] = {children: 1};
      //self._client.updateTerritory(self._territoryId, self._selfPatterns);
    };

    this._graphVizWidget.onNodeClose = function (id) {
      // TODO: optimize the territory that it is listening to?
    };
  };

  GraphVizControl.prototype.selectedObjectChanged = async function (nodeId) {
    var self = this;

    // TODO: get the path of the transformation node
    this._currentNodeId = nodeId;
    this._currentNodeParentId = undefined;

    this._nodes = {};

    if (typeof this._currentNodeId === "string") {
      const transNodeId = this._getTransformationNodeID(nodeId);
      console.log('observe', nodeId, transNodeId);
      this._transformObs.observe(nodeId, transNodeId);

      const node = this._client.getNode(nodeId);
      const title = node.getAttribute("name") || "";
      this._graphVizWidget.setTitle(title.toUpperCase());
      this._currentNodeParentId = node.getParentId();
    }
  };

  GraphVizControl.prototype._getTransformationNodeID = function (nodeId) {
    const node = this._client.getNode(nodeId);
    const sets = node.getSetNames();
    if (sets.includes(SET_NAME)) {
      const members = node.getMemberIds(SET_NAME);
      return members.find(
        (memberId) =>
          node.getMemberAttribute(SET_NAME, memberId, "engine") === ENGINE_NAME,
      );
    }
    // TODO: This will need to be updated when we support this properly.
    // That is, this should get the name, etc, from here
  };

  GraphVizControl.prototype._getObjectDescriptor = function (nodeJson, libraryMeta) {
    // get the children who are types of interactions (rm them from child list)
    const [interactions, children] = _.partition(
        nodeJson.children || [],
        child => libraryMeta.isTypeOf(child, 'Interaction')
    );

    const interactionDict = Object.fromEntries(
      interactions.map(nodeJson => [nodeJson.typeName, InteractionHandler.from(nodeJson)])
    );
      
    // TODO: convert them to "Interactions" and actions
    return {
      id: nodeJson.path,
      name: nodeJson.attributes.name,
      children: children.map((child) =>
        this._getObjectDescriptor(child, libraryMeta)
      ),
      childrenNum: nodeJson.children.length,
      color: nodeJson.attributes.color,
      interactions: interactionDict,
      //status: 'open' || 'closed' || 'LEAF' || 'opening' || 'CLOSING',
    };
  };

  GraphVizControl.prototype.getCoreInstance = async function () {
    return await new Promise(
      (resolve, reject) =>
        this._client.getCoreInstance(
          null,
          (err, result) => err ? reject(err) : resolve(result),
        ),
    );
  };

  // PUBLIC METHODS
  GraphVizControl.prototype.destroy = function () {
    this._transformObs.disconnect();

    this._detachClientEventListeners();
    this._removeToolbarItems();
  };

  GraphVizControl.prototype._stateActiveObjectChanged = function (
    model,
    activeObjectId,
  ) {
    if (this._currentNodeId === activeObjectId) {
      // [patrik] added this check to avoid redrawing when becoming active in split panel mode.
      this._logger.debug(
        "Disregarding activeObject changed when it is already the same.",
      );
    } else {
      this.selectedObjectChanged(activeObjectId);
    }
  };

  GraphVizControl.prototype._attachClientEventListeners = function () {
    this._detachClientEventListeners();
    WebGMEGlobal.State.on(
      "change:" + CONSTANTS.STATE_ACTIVE_OBJECT,
      this._stateActiveObjectChanged,
      this,
    );
  };

  GraphVizControl.prototype._detachClientEventListeners = function () {
    WebGMEGlobal.State.off(
      "change:" + CONSTANTS.STATE_ACTIVE_OBJECT,
      this._stateActiveObjectChanged,
    );
  };

  GraphVizControl.prototype.onActivate = function () {
    this._attachClientEventListeners();
    this._displayToolbarItems();

    //setting the active object to the root of the graph
    if (typeof this._currentNodeId === "string") {
      WebGMEGlobal.State.registerActiveObject(this._currentNodeId, {
        suppressVisualizerFromNode: true,
      });
    }
  };

  GraphVizControl.prototype.onDeactivate = function () {
    this._detachClientEventListeners();
    this._hideToolbarItems();
  };

  GraphVizControl.prototype._displayToolbarItems = function () {
    var i;

    if (this._toolbarInitialized === true) {
      for (i = 0; i < this._toolbarItems.length; i++) {
        this._toolbarItems[i].show();
      }
    } else {
      this._initializeToolbar();
    }
  };

  GraphVizControl.prototype._hideToolbarItems = function () {
    var i;

    if (this._toolbarInitialized === true) {
      for (i = 0; i < this._toolbarItems.length; i++) {
        this._toolbarItems[i].hide();
      }
    }
  };

  GraphVizControl.prototype._removeToolbarItems = function () {
    var i;

    if (this._toolbarInitialized === true) {
      for (i = 0; i < this._toolbarItems.length; i++) {
        this._toolbarItems[i].destroy();
      }
    }
  };

  GraphVizControl.prototype._initializeToolbar = function () {
    var toolBar = WebGMEGlobal.Toolbar;

    this._toolbarItems = [];

    this._toolbarItems.push(toolBar.addSeparator());
    /************** MODEL / CONNECTION filter *******************/
    //
    // this.$cbShowConnection = toolBar.addCheckBox({
    //     title: 'Show connection',
    //     icon: 'gme icon-gme_diagonal-arrow',
    //     checkChangedFn: function (data, checked) {
    //         self._displayModelsOnly = !checked;
    //         self._generateData();
    //     }
    // });
    //
    // this._toolbarItems.push(this.$cbShowConnection);
    /************** END OF - MODEL / CONNECTION filter *******************/

    this._toolbarInitialized = true;
  };

  GraphVizControl.prototype._addSplitPanelToolbarBtns = function (toolbarEl) {
    var self = this,
      connBtn = $(
        '<span class="split-panel-toolbar-btn no-print glyphicon glyphicon-filter"></span>',
      );

    connBtn.on("click", function () {
      self._displayModelsOnly = !self._displayModelsOnly;
      if (self._displayModelsOnly) {
        connBtn.attr("title", "Show connections");
      } else {
        connBtn.attr("title", "Hide connections");
      }
      self._generateData();
    });

    if (self._displayModelsOnly) {
      connBtn.attr("title", "Show connections");
    } else {
      connBtn.attr("title", "Hide connections");
    }

    toolbarEl.append(connBtn);

    connBtn.hide();

    return toolbarEl;
  };

  GraphVizControl.prototype.onExtendMenuItems = function (nodeId, menuItems) {
    const node = this._client.getNode(nodeId);
    const childIds = Object.keys(node?.getValidChildrenTypesDetailed() || {});
    if (childIds.length > 0) {
      const childMenuItems = {};
      const validChildren = childIds.forEach((id) => {
        const node = this._client.getNode(id);
        childMenuItems[id] = {
          name: node.getAttribute("name"),
          callback: () => {
            const params = {
              parentId: nodeId,
              baseId: id,
            };
            this._client.createNode(params);
          },
        };
      });

      menuItems.createNode = {
        name: "Create child",
        icon: "add",
        items: childMenuItems,
      };
    }
    return menuItems;
  };

  class DefaultTransformation {
    constructor(core) {
      this.core = core;
    }

    async apply(node) {
      const children = await this.core.loadChildren(node);
      return [{
        attributes: {
          name: this.core.getAttribute(node, "name"),
        },
        children: (await Promise.all(children.map((child) =>
          this.apply(child)
        ))).flat(),
      }];
    }
  }

  class NodePathResolver {
      constructor(core, nodeDict) {
        this._core = core;
        this._dict = nodeDict;
      }

      resolve(nodePath) {
        const node = this._dict[nodePath];
        if (node) {
          return this._core.getAttribute(node, 'name');
          
        }
      }

      resolveType(node) {
        if (node.pointers && node.pointers.base) {
          node.typeName = this.resolve(node.pointers.base);
        }
        if (node.children) {
          node.children = node.children.map(child => this.resolveType(child));
        }
        return node;
      }

      isTypeOf(node, typeName) {
        const basePath = node.pointers.base;
        let nodeIter = this._dict[basePath];
        while (nodeIter) {
          if (this._core.getAttribute(nodeIter, 'name') === typeName) {
            return true;
          }
          nodeIter = this._core.getBase(nodeIter);
        }

        return false;
      }
  }

  class InteractionHandler {
      constructor(actions) {
        // TODO: parse the actions
      }

      trigger() {
        console.log('running interaction handler!');
      }

      static from(libraryMeta, nodeJson) {
        console.log('parsing actions...');
        console.log({nodeJson});
        // TODO: parse the actions
        return new InteractionHandler();
      }
  }

  return GraphVizControl;
});
