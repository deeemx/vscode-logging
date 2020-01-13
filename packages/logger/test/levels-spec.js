const { map, forEach, pickBy, take } = require("lodash");
const { expect } = require("chai");
const proxyquire = require("proxyquire").noCallThru();

const { levels, levelsConfig } = require("../lib/levels");
const { VSCodeStub } = require("./stubs/vscode-stub");

describe("VSCode Extension Logger", () => {
  /**
   * @type {typeof import("../api").getExtensionLogger}
   */
  let getExtensionLogger;
  let vsCodeStub;
  beforeEach(() => {
    // VSCode outChannel is always enabled so we still need a stub for it
    // even if we are only interested in the rolling File Logger
    vsCodeStub = new VSCodeStub();
    const mainModuleStubbed = proxyquire("../lib/api.js", {
      vscode: vsCodeStub
    });
    getExtensionLogger = mainModuleStubbed.getExtensionLogger;
  });

  context("when using an invalid level", () => {
    it(`will throw on initial invalid level`, () => {
      expect(() => {
        getExtensionLogger({
          extName: "MyExtName",
          level: "Emergency" // This is a sysLog severity
        });
      }).to.throw("Attempt to use unknown logging level: <Emergency>!");
    });

    it(`will warn and ignore on subsequent invalid level`, () => {
      const extLogger = getExtensionLogger({
        extName: "MyExtName",
        level: "fatal"
      });

      extLogger.changeLevel("Emergency");
      const logEntries = map(vsCodeStub.lines, JSON.parse);
      expect(logEntries[0].message).to.eql(
        "Attempt to use unknown logging level: <Emergency> has been ignored."
      );

      expect(vsCodeStub.lines).to.have.lengthOf(1);
      extLogger.error(
        "should not be logger as the logger should still be on fatal mode"
      );
      expect(vsCodeStub.lines).to.have.lengthOf(1);
      extLogger.fatal("should be logged");
      expect(vsCodeStub.lines).to.have.lengthOf(2);
    });
  });

  context("Specific logging Levels Support", () => {
    const allLevelsExceptOff = pickBy(levels, levelKey => levelKey !== "off");

    const fullExpectedLogEntries = [
      {
        level: "fatal",
        message: "fatal"
      },
      {
        level: "error",
        message: "error"
      },
      {
        level: "warn",
        message: "warn"
      },
      {
        level: "info",
        message: "info"
      },
      {
        level: "debug",
        message: "debug"
      },
      {
        level: "trace",
        message: "trace"
      }
    ];

    forEach(levels, currLevel => {
      it(`will only log correct levels in '${currLevel}'`, () => {
        const extLogger = getExtensionLogger({
          extName: "MyExtName",
          level: currLevel
        });

        // try logging using all the possible levels
        forEach(allLevelsExceptOff, level => {
          extLogger[level](level);
        });

        const logEntries = map(vsCodeStub.lines, JSON.parse);

        // The higher the log level the more entries are expected to be logged.
        const expectedLogEntries = take(
          fullExpectedLogEntries,
          // 0 based index necessitates '+1"
          levelsConfig[currLevel] + 1
        );

        expect(logEntries)
          .excluding(["time", "label"])
          .to.deep.eql(expectedLogEntries);
      });
    });
  });
});
