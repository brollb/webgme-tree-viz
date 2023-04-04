define([
  "webgme-graph-viz/dialog/index",
], function (
  Dialog,
) {
  // Pointers can only reference siblings in the containment hierarchy (for actions)
  function resolvePointerTarget(target, parentNode) {
    const targetNode = parentNode.children.find((child) => child.id === target);
    if (!targetNode) {
      throw new Error(`Could not find pointer target: ${target}`);
    }

    if (targetNode.typeName === "Constant") {
      return new ConstantTarget(targetNode.attributes.value);
    }
    return new RuntimeDataTarget(target);
  }

  class PointerRef {
    //resolve(runData)
  }

  class ConstantTarget extends PointerRef {
    constructor(value) {
      super();
      this.value = value;
    }
    resolve(runData) {
      return this.value;
    }
  }

  class RuntimeDataTarget extends PointerRef {
    constructor(id) {
      super();
      this.id = id;
    }
    resolve(runData) {
      return runData[this.id];
    }
  }

  class Action {
    async run(data) {
      throw new Error("Unimplemented!");
    }
  }

  class Prompt extends Action {
    constructor(nodeJson) {
      super();
      this.message = nodeJson.attributes.message;
      this.actions = parseActions(nodeJson);
      const answer = nodeJson.children.find((child) =>
        child.typeName === "Answer"
      );
      if (answer) {
        this.answerId = answer.id;
      }
    }

    async run(data) {
      const answer = await Dialog.prompt(this.message);
      if (this.answerId) {
        data[this.answerId] = answer;
      }

      this.actions.forEach((action) => action.run(data));
    }
  }

  class Select extends Action {
    constructor(nodeJson) {
      super();
      this.message = nodeJson.attributes.message;
      this.actions = parseActions(nodeJson);
      console.log({ nodeJson });
      this.options = nodeJson.children.filter((child) =>
        child.typeName === "Option"
      )
        .map((child) => new Option(child));

      const answer = nodeJson.children.find((child) =>
        child.typeName === "Answer"
      );
      if (answer) {
        this.answerId = answer.id;
      }
    }

    async run(data) {
      // TODO: allow options to be dynamic?
      const answer = await Dialog.select(this.message, this.options);
      if (!answer) return; // should this be configurable?

      if (this.answerId) {
        data[this.answerId] = answer.id;
      }

      this.actions.forEach((action) => action.run(data));
    }
  }

  class Option {
    constructor(nodeJson) {
      this.name = nodeJson.attributes.name;
      this.id = nodeJson.attributes.id || this.name;
    }
  }

  class Confirm extends Action {
    constructor(nodeJson) {
      this.message = nodeJson.attributes.message;
      this.actions = parseActions(nodeJson);
    }
    async run(data) {
      const confirmed = await Dialog.confirm(this.message);
      if (confirmed) {
        this.actions.forEach((action) => action.run(data));
      }
    }
  }

  class SetPointer extends Action {
    constructor(nodeJson, parent) {
      super();
      this.nodeJson = nodeJson;
      this.nodePath = resolvePointerTarget(nodeJson.pointers.node, parent);
      this.pointer = resolvePointerTarget(
        nodeJson.pointers.pointer,
        parent,
      );
      this.target = resolvePointerTarget(nodeJson.pointers.target, parent);
    }

    async run(data) {
      const nodePath = this.nodePath.resolve(data);
      const pointer = this.pointer.resolve(data);
      const target = this.target.resolve(data);
      WebGMEGlobal.Client.setPointer(nodePath, pointer, target);
    }
  }

  class SetAttribute extends Action {
    constructor(nodeJson, parent) {
      super();
      this.nodeJson = nodeJson;
      this.nodePath = resolvePointerTarget(nodeJson.pointers.node, parent);
      this.attribute = resolvePointerTarget(
        nodeJson.pointers.attribute,
        parent,
      );
      this.value = resolvePointerTarget(nodeJson.pointers.value, parent);
    }

    async run(data) {
      const nodePath = this.nodePath.resolve(data);
      const attribute = this.attribute.resolve(data);
      const value = this.value.resolve(data);
      WebGMEGlobal.Client.setAttribute(nodePath, attribute, value);
    }
  }

  class SetActiveNode extends Action {
    constructor(nodeJson, parent) {
      super();
      this.nodeJson = nodeJson;
      this.nodePath = resolvePointerTarget(nodeJson.pointers.node, parent);
    }

    async run(data) {
      const nodePath = this.nodePath.resolve(data);
      WebGMEGlobal.State.registerActiveObject(nodePath);
    }
  }

  const ACTION_TYPES = [];
  function registerAction(actionClass) {
    ACTION_TYPES.push(actionClass);
  }

  function parseActions(parent) {
    return filterMap(
      parent.children,
      (child) => {
        const ActionType = ACTION_TYPES.find((ActionClass) =>
          ActionClass.name === child.typeName
        );
        if (ActionType) {
          return new ActionType(child, parent);
        }
      },
    );
  }

  function parseOptions(parent) {
    // TODO: create the options
  }

  function filterMap(list, fn) {
    return list.reduce((results, item) => {
      const mapped = fn(item);
      if (mapped) {
        results.push(mapped);
      }
      return results;
    }, []);
  }

  const Actions = {
    Prompt,
    Select,
    Confirm,

    SetAttribute,
    SetActiveNode,
    SetPointer,
  };

  Object.values(Actions).forEach(registerAction);

  Actions.parse = parseActions;

  return Actions;
});
