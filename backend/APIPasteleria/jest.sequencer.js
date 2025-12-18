const Sequencer = require("@jest/test-sequencer").default;

class ByPathSequencer extends Sequencer {
  sort(tests) {
    return [...tests].sort((a, b) => {
      const pathA = (a.path || "").replace(/\\/g, "/");
      const pathB = (b.path || "").replace(/\\/g, "/");
      return pathA.localeCompare(pathB);
    });
  }
}

module.exports = ByPathSequencer;
