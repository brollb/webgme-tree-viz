/*globals define, _, WebGMEGlobal, $*/
/*jshint browser: true*/
/**
 * @author rkereskenyi / https://github.com/rkereskenyi
 * @author nabana / https://github.com/nabana
 */

define(['js/logger',
    'js/util',
    'js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames'
], function (Logger,
             util,
             CONSTANTS,
             GMEConcepts,
             nodePropertyNames) {

    'use strict';

    const SET_NAME = 'visualizers';

    var GraphVizControl;

    GraphVizControl = function (options) {

        this._logger = Logger.create('gme:Panels:GraphViz:GraphVizControl', WebGMEGlobal.gmeConfig.client.log);

        this._client = options.client;

        //initialize core collections and variables
        this._graphVizWidget = options.widget;

        this._currentNodeId = null;
        this._currentNodeParentId = undefined;

        this._displayModelsOnly = false;

        this._initWidgetEventHandlers();

        this._logger.debug('Created');
    };

    GraphVizControl.prototype._initWidgetEventHandlers = function () {
        var self = this;

        this._graphVizWidget.onBackgroundDblClick = function () {
            if (self._currentNodeParentId) {
                WebGMEGlobal.State.registerActiveObject(self._currentNodeParentId);
            }
        };

        this._graphVizWidget.onNodeOpen = function (id) {
            self._selfPatterns[id] = {children: 1};
            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        };

        this._graphVizWidget.onNodeDblClick = function (id) {
            WebGMEGlobal.State.registerActiveObject(id);
        };

        this._graphVizWidget.onExtendMenuItems = (nodeId, menuItems) => {
            return this.onExtendMenuItems(nodeId, menuItems);
        };

        this._graphVizWidget.deleteNode = nodeId => {
            this._client.deleteNode(nodeId);
        };

        this._graphVizWidget.setName = (nodeId, name) => {
            this._client.setAttribute(nodeId, 'name', name);
        };

        this._graphVizWidget.onNodeClose = function (id) {
            var deleteRecursive,
                node,
                childrenIDs,
                i;

            deleteRecursive = function (nodeId) {
                if (self._selfPatterns.hasOwnProperty(nodeId)) {
                    node = self._nodes[nodeId];

                    if (node) {
                        childrenIDs = node.childrenIDs;
                        for (i = 0; i < childrenIDs.length; i += 1) {
                            deleteRecursive(childrenIDs[i]);
                        }
                    }

                    delete self._selfPatterns[nodeId];
                }
            };

            //call the cleanup recursively
            deleteRecursive(id);

            if (id === self._currentNodeId) {
                self._selfPatterns[id] = {children: 0};
            }

            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        };
    };

    GraphVizControl.prototype.selectedObjectChanged = async function (nodeId) {
        var self = this;

        this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        //remove current territory patterns
        if (this._currentNodeId) {
            this._client.removeUI(this._territoryId);
        }

        this._currentNodeId = nodeId;
        this._currentNodeParentId = undefined;

        this._nodes = {};

        if (typeof this._currentNodeId === 'string') {
            //put new node's info into territory rules
            this._selfPatterns = {};
            this._selfPatterns[nodeId] = {children: Infinity};

            const node = this._client.getNode(nodeId);
            const title = node.getAttribute('name') || '';
            this._graphVizWidget.setTitle(title.toUpperCase());

            this._currentNodeParentId = node.getParentId();

            this._territoryId = this._client.addUI(
                this,
                () => {
                    if (nodeId === this._currentNodeId) {
                        this._onTerritoryLoaded(nodeId);
                    }
                }
            );

            this._client.updateTerritory(this._territoryId, this._selfPatterns);

            // update the territory
            const transNodeID = this._getTransformationNodeID(nodeId);
            if (transNodeID) {
                this._transformationTerritory = this._client.addUI(
                    this,
                    async () => {
                        if (nodeId === this._currentNodeId) {
                            const {core, rootNode} = await this.getCoreInstance();
                            const node = await core.loadByPath(rootNode, nodeId);
                            const transformation = await Transformation.fromNode(core, node);
                            this._setTransformation(core, node, transformation);
                        }
                    }
                );

                const pattern = {};
                pattern[transNodeID] = {children: Infinity}
                this._client.updateTerritory(this._transformationTerritory, pattern);
            } else {
                const {core, rootNode} = await this.getCoreInstance();
                const node = await core.loadByPath(rootNode, nodeId);
                this._setTransformation(core, node, new DefaultTransformation(core));
            }
        }
    };

    GraphVizControl.prototype._setTransformation = function (core, node, transformation) {
        const nodeId = core.getPath(node);
        if (this._currentNodeId === nodeId) {
            this.transformation = transformation;
            console.log('setting transformation');
            this._onUpdateWidget(transformation, node);
        }
    };

    GraphVizControl.prototype._getTransformationNodeID = function (nodeId) {
        const node = this._client.getNode(nodeId);
        const sets = node.getSetNames();
        if (sets.includes(SET_NAME)) {
            const members = node.getMemberIds(SET_NAME);
            return members.find(
                memberId => node.getMemberAttribute(SET_NAME, memberId, 'visualizer') === 'GraphViz'
            );
        }
        // TODO: This will be a little
    };

    GraphVizControl.prototype._getObjectDescriptor = function (nodeJson) {
        return {
            id: nodeJson.path,
            name: nodeJson.attributes.name,
            children: nodeJson.children.map(child => this._getObjectDescriptor(child)),
            childrenNum: nodeJson.children.length,
            //status: 'open' || 'closed' || 'LEAF' || 'opening' || 'CLOSING',
        };
    };

    GraphVizControl.prototype.getCoreInstance = async function () {
        return await new Promise(
            (resolve, reject) => this._client.getCoreInstance(null, (err, result) => err ? reject(err) : resolve(result))
        );
    };

    GraphVizControl.prototype._onTerritoryLoaded = function (nodeId) {
        console.log('territory loaded!', nodeId);
        if (this.transformation) {
        }
        // TODO: apply the transformation to the domain model
        // TODO: convert the WJI format to the expected format
    };

    GraphVizControl.prototype._onUpdateWidget = async function (transformation, model) {
        const viewModelNodes = await transformation.apply(model);
        const data = viewModelNodes.map(node => this._getObjectDescriptor(node));
        console.log('set data to', data);
        this._graphVizWidget.setData(data[0]);
    };

    // PUBLIC METHODS
    GraphVizControl.prototype.destroy = function () {
        if (this._territoryId) {
            this._client.removeUI(this._territoryId);
        }

        this._detachClientEventListeners();
        this._removeToolbarItems();
    };

    GraphVizControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        if (this._currentNodeId === activeObjectId) {
            // [patrik] added this check to avoid redrawing when becoming active in split panel mode.
            this._logger.debug('Disregarding activeObject changed when it is already the same.');
        } else {
            this.selectedObjectChanged(activeObjectId);
        }
    };

    GraphVizControl.prototype._attachClientEventListeners = function () {
        this._detachClientEventListeners();
        WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
    };

    GraphVizControl.prototype._detachClientEventListeners = function () {
        WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
    };

    GraphVizControl.prototype.onActivate = function () {
        this._attachClientEventListeners();
        this._displayToolbarItems();

        //setting the active object to the root of the graph
        if (typeof this._currentNodeId === 'string') {
            WebGMEGlobal.State.registerActiveObject(this._currentNodeId, {suppressVisualizerFromNode: true});
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
            connBtn = $('<span class="split-panel-toolbar-btn no-print glyphicon glyphicon-filter"></span>');

        connBtn.on('click', function () {
            self._displayModelsOnly = !self._displayModelsOnly;
            if (self._displayModelsOnly) {
                connBtn.attr('title', 'Show connections');
            } else {
                connBtn.attr('title', 'Hide connections');
            }
            self._generateData();
        });

        if (self._displayModelsOnly) {
            connBtn.attr('title', 'Show connections');
        } else {
            connBtn.attr('title', 'Hide connections');
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
            const validChildren = childIds.forEach(id => {
                const node = this._client.getNode(id);
                childMenuItems[id] = {
                    name: node.getAttribute('name'),
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
                name: 'Create child',
                icon: 'add',
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
                    name: this.core.getAttribute(node, 'name'),
                },
                children: (await Promise.all(children.map(child => this.apply(child)))).flat(),
            }];
        }
    }

    return GraphVizControl;
});
