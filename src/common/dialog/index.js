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
    return window.prompt(message);
  }

  async function select(message, options) {
    // FIXME: what should be done if options.length === 0?
    if (options.length < 2) {
      return options[0];
    }

    let answer;
    const optsStr = options.map((opt, i) => `${i + 1}. ${opt.name}`).join("\n");
    const msg = `${message}\n\nOptions:\n${optsStr}`;
    const answerOpts = options.map((_, i) => i + 1);

    while (!answerOpts.includes(answer)) {
      answer = +window.prompt(msg);
    }
    return options[answer - 1];
  }

  async function confirm(message) {
    return window.confirm(message);
  }

  return {
    select,
    confirm,
    prompt,
  };
});
