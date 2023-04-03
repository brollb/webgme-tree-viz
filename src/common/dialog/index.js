define(["./micromodal.min"], function (mm) {
  console.log({ mm });
  // TODO: use micromodal
  class Dialog {
    constructor() {
    }
  }

  class Select extends Dialog {
    constructor() {
    }
  }

  class Confirm extends Dialog {
  }

  class Prompt extends Dialog {
  }

  async function prompt(message) {
  }

  async function select(message, options) {
  }

  async function confirm(message) {
  }

  return {
    select,
    confirm,
    prompt,
  };
});
