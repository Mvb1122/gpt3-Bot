module.exports.GPTMessage = class GPTMessage {
  /** @type {"System" | "User" | "Function" | "Tool" | "Assistant"} */
  role;

  /**@type {string} */
  name;

  /** @type {string | {type: string, image_url: {url: string, detail: "low" | "high"} | undefined, text: string | undefined}[]} */
  content;

  /** @type {{ name: string; arguments: string; }[]} */
  tool_calls;

  /**
   * @param {string} message
   * @param {"System" | "User" | "Function" | "Tool" | "Assistant"} role
   */
  constructor(message, role = "User") {
    this.role = role;
    this.content = message;
  }
};
