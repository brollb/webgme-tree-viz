define([
], function() {

  // Pointers can only reference siblings in the containment hierarchy (for actions)
  function resolvePointerTarget(target, parentNode) {
    const targetNode = parentNode.children.find(child => child.id === target);
    if (!targetNode) {
      throw new Error(`Could not find pointer target: ${target}`);
    }

    if (targetNode.typeName === 'Constant') {
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
      const answer = nodeJson.children.find(child => child.typeName === 'Answer');
      if (answer) {
        this.answerId = answer.id;
      }
    }

    async run(data) {
      // TODO: store the response...
      const answer = window.prompt(this.message);
      if (this.answerId) {
        data[this.answerId] = answer;
      }

      this.actions.forEach(action => action.run(data));
    }
  }

  class Select extends Action {

  }
  class Confirm extends Action {
    constructor(nodeJson) {
      this.message = nodeJson.attributes.message;
      this.actions = parseActions(nodeJson);
    }
    async run(data) {
      const confirmed = confirm(this.message);
      if (confirmed) {
        this.actions.forEach(action => action.run(data));
      }
    }
  }

  class SetPointer extends Action { }  // TODO

  class SetAttribute extends Action {
    constructor(nodeJson, parent) {
      super();
      this.nodeJson = nodeJson;
      this.nodePath = resolvePointerTarget(nodeJson.pointers.node, parent);
      this.attribute = resolvePointerTarget(nodeJson.pointers.attribute, parent);
      this.value = resolvePointerTarget(nodeJson.pointers.value, parent);
    }

    async run(data) {
      const nodePath = this.nodePath.resolve(data);
      const attribute = this.attribute.resolve(data);
      const value = this.value.resolve(data);
      WebGMEGlobal.Client.setAttribute(nodePath, attribute, value);
    }
  }

  const ACTION_TYPES = [];
  function registerAction(actionClass) {
    ACTION_TYPES.push(actionClass);
  }

  function parseActions(parent) {
    return filterMap(
      parent.children,
      child => {
        const ActionType = ACTION_TYPES.find(ActionClass => ActionClass.name === child.typeName);
        if (ActionType) {
          return new ActionType(child, parent);

        }
      }
    );
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
    SetPointer,
  };

  Object.values(Actions).forEach(registerAction);

  Actions.parse = parseActions;

  return Actions;
});
