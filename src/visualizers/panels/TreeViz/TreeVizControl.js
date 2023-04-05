/*globals define, _, WebGMEGlobal, $*/
/*jshint browser: true*/
/**
 * @author rkereskenyi / https://github.com/rkereskenyi
 * @author nabana / https://github.com/nabana
 */

define([
  "js/logger",
  "webgme-transformations/dist/common/index", // FIXME: remove dist/common
  "js/Constants",
  "./Actions",
  "underscore",
], function (
  Logger,
  GMETransformations,
  CONSTANTS,
  Actions,
  _,
) {
  "use strict";

  console.log({ GMETransformations });
  const { TransformationObserver } = GMETransformations;
  const SET_NAME = "visualizers";
  const ENGINE_NAME = "TreeViz";

  var TreeVizControl;

  TreeVizControl = function (options) {
    this._logger = Logger.create(
      "gme:Panels:TreeViz:TreeVizControl",
      WebGMEGlobal.gmeConfig.client.log,
    );

    this._client = options.client;

    //initialize core collections and variables
    this._treeVizWidget = options.widget;
    this._transformObs = new TransformationObserver(
      this._client,
      (core, rootNode) => new DefaultTransformation(core, rootNode),
      async (viewModel) => {
        //const isNodeStillActive = (nodeId) => nodeId === this._currentNodeId;
        // resolve the metamodel nodes to their names
        const { core, rootNode } = await this.getCoreInstance();
        const libraryMeta = getLibraryMeta(core, rootNode);
        viewModel = viewModel.map((node) => libraryMeta.resolveType(node));

        const data = viewModel.map((node) =>
          this._getObjectDescriptor(node, libraryMeta)
        );
        console.log("set data to", data);
        this._treeVizWidget.setData(data[0]);
      },
    );
    this._currentNodeId = null;
    this._currentNodeParentId = undefined;

    this._displayModelsOnly = false;

    this._initWidgetEventHandlers();

    this._logger.debug("Created");
  };

  TreeVizControl.prototype._initWidgetEventHandlers = function () {
    var self = this;

    this._treeVizWidget.onBackgroundDblClick = function () {
      if (self._currentNodeParentId) {
        WebGMEGlobal.State.registerActiveObject(self._currentNodeParentId);
      }
    };

    this._treeVizWidget.onNodeDblClick = function (id) {
      WebGMEGlobal.State.registerActiveObject(id);
    };

    this._treeVizWidget.onExtendMenuItems = (nodeId, menuItems) => {
      return this.onExtendMenuItems(nodeId, menuItems);
    };

    this._treeVizWidget.deleteNode = (nodeId) => {
      this._client.deleteNode(nodeId);
    };

    this._treeVizWidget.setName = (nodeId, name) => {
      this._client.setAttribute(nodeId, "name", name);
    };

    this._treeVizWidget.onNodeOpen = function (id) {
      //self._selfPatterns[id] = {children: 1};
      //self._client.updateTerritory(self._territoryId, self._selfPatterns);
    };

    this._treeVizWidget.onNodeClose = function (id) {
      // TODO: optimize the territory that it is listening to?
    };
  };

  TreeVizControl.prototype.selectedObjectChanged = async function (nodeId) {
    var self = this;

    // TODO: get the path of the transformation node
    this._currentNodeId = nodeId;
    this._currentNodeParentId = undefined;

    this._nodes = {};

    if (typeof this._currentNodeId === "string") {
      const transNodeId = this._getTransformationNodeID(nodeId);
      console.log("observe", nodeId, transNodeId);
      this._transformObs.observe(nodeId, transNodeId);

      const node = this._client.getNode(nodeId);
      const title = node.getAttribute("name") || "";
      this._treeVizWidget.setTitle(title.toUpperCase());
      this._currentNodeParentId = node.getParentId();
    }
  };

  TreeVizControl.prototype._getTransformationNodeID = function (nodeId) {
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

  TreeVizControl.prototype._getObjectDescriptor = function (
    nodeJson,
    libraryMeta,
  ) {
    // get the children who are types of interactions (rm them from child list)
    const [interactions, children] = _.partition(
      nodeJson.children || [],
      (child) => libraryMeta.isTypeOf(child, "Interaction"),
    );

    const interactionDict = Object.fromEntries(
      interactions.map(
        (nodeJson) => [
          nodeJson.typeName,
          InteractionHandler.from(nodeJson, libraryMeta),
        ],
      ),
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

  TreeVizControl.prototype.getCoreInstance = async function () {
    return await new Promise(
      (resolve, reject) =>
        this._client.getCoreInstance(
          null,
          (err, result) => err ? reject(err) : resolve(result),
        ),
    );
  };

  // PUBLIC METHODS
  TreeVizControl.prototype.destroy = function () {
    this._transformObs.disconnect();

    this._detachClientEventListeners();
    this._removeToolbarItems();
  };

  TreeVizControl.prototype._stateActiveObjectChanged = function (
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

  TreeVizControl.prototype._attachClientEventListeners = function () {
    this._detachClientEventListeners();
    WebGMEGlobal.State.on(
      "change:" + CONSTANTS.STATE_ACTIVE_OBJECT,
      this._stateActiveObjectChanged,
      this,
    );
  };

  TreeVizControl.prototype._detachClientEventListeners = function () {
    WebGMEGlobal.State.off(
      "change:" + CONSTANTS.STATE_ACTIVE_OBJECT,
      this._stateActiveObjectChanged,
    );
  };

  TreeVizControl.prototype.onActivate = function () {
    this._attachClientEventListeners();
    this._displayToolbarItems();

    //setting the active object to the root of the graph
    if (typeof this._currentNodeId === "string") {
      WebGMEGlobal.State.registerActiveObject(this._currentNodeId, {
        suppressVisualizerFromNode: true,
      });
    }
  };

  TreeVizControl.prototype.onDeactivate = function () {
    this._detachClientEventListeners();
    this._hideToolbarItems();
  };

  TreeVizControl.prototype._displayToolbarItems = function () {
    var i;

    if (this._toolbarInitialized === true) {
      for (i = 0; i < this._toolbarItems.length; i++) {
        this._toolbarItems[i].show();
      }
    } else {
      this._initializeToolbar();
    }
  };

  TreeVizControl.prototype._hideToolbarItems = function () {
    var i;

    if (this._toolbarInitialized === true) {
      for (i = 0; i < this._toolbarItems.length; i++) {
        this._toolbarItems[i].hide();
      }
    }
  };

  TreeVizControl.prototype._removeToolbarItems = function () {
    var i;

    if (this._toolbarInitialized === true) {
      for (i = 0; i < this._toolbarItems.length; i++) {
        this._toolbarItems[i].destroy();
      }
    }
  };

  TreeVizControl.prototype._initializeToolbar = function () {
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

  TreeVizControl.prototype._addSplitPanelToolbarBtns = function (toolbarEl) {
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

  TreeVizControl.prototype.onExtendMenuItems = function (nodeId, menuItems) {
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
    constructor(core, rootNode) {
      this.core = core;
      this.root = rootNode;
      this.libraryMeta = getLibraryMeta(this.core, this.root);
    }

    _createNode(type, name) {
      const node = {
        pointers: { base: this.libraryMeta.getTypePath(type) },
        attributes: {},
        children: [],
      };
      if (name) {
        node.attributes.name = name;
      }
      return node;
    }

    async apply(gmeNode) {
      const name = this.core.getAttribute(gmeNode, "name");
      const nodePath = this.core.getPath(gmeNode);
      const node = this._createNode("Node", name);

      const childNodes = await this.core.loadChildren(gmeNode);
      const children = await Promise.all(
        childNodes.map((child) => this.apply(child)),
      );

      node.children = children.flat();

      // Add double click to open
      const dblClick = this._createNode("DoubleClick");
      const setActive = this._createNode("SetActiveNode");
      const targetNode = this._createNode("Constant");
      targetNode.attributes.value = nodePath;
      targetNode.id = `@id:setActiveTarget_${nodePath}`;
      setActive.pointers.node = targetNode.id;

      dblClick.children.push(setActive, targetNode);
      node.children.push(dblClick);

      return [node];
    }
  }

  class NodePathResolver {
    constructor(core, nodeDict) {
      this._core = core;
      this._dict = nodeDict;
      this._nodes = Object.values(this._dict);
    }

    getTypePath(typeName) {
      const node = this._nodes.find((node) =>
        this._core.getAttribute(node, "name") === typeName
      );
      return node && this._core.getPath(node);
    }

    resolve(nodePath) {
      const node = this._dict[nodePath];
      if (node) {
        return this._core.getAttribute(node, "name");
      }
    }

    resolveType(node) {
      if (node.pointers && node.pointers.base) {
        node.typeName = this.resolve(node.pointers.base);
      }
      if (node.children) {
        node.children = node.children.map((child) => this.resolveType(child));
      }
      return node;
    }

    isTypeOf(node, typeName) {
      const basePath = node.pointers.base;
      let nodeIter = this._dict[basePath];
      while (nodeIter) {
        if (this._core.getAttribute(nodeIter, "name") === typeName) {
          return true;
        }
        nodeIter = this._core.getBase(nodeIter);
      }

      return false;
    }
  }

  class InteractionHandler {
    constructor(actions) {
      this.actions = actions;
    }

    async trigger() {
      console.log("running interaction handler!");
      const initialData = {};
      await Promise.all(this.actions.map((act) => act.run(initialData)));
    }

    static from(nodeJson, libraryMeta) {
      // TODO: we should probably change the model to use references instead of connections...
      // TODO: check if they are actions
      const actions = Actions.parse(nodeJson);
      return new InteractionHandler(actions);
    }
  }

  function getLibraryMeta(core, rootNode) {
    const metanodes = core.getLibraryMetaNodes(rootNode, ENGINE_NAME);
    return new NodePathResolver(core, metanodes);
  }

  return TreeVizControl;
});
