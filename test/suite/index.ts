import * as path from "path";
import * as fs from "fs";
import Mocha from "mocha";

export async function run(): Promise<void> {
  console.log("[test-runner] booting mocha...");
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 60_000,
  });

  const testsRoot = __dirname;
  const files = fs.readdirSync(testsRoot).filter((f) => f.endsWith(".test.js"));
  console.log("[test-runner] discovered:", files);
  for (const entry of files) {
    mocha.addFile(path.resolve(testsRoot, entry));
  }

  return new Promise((resolve, reject) => {
    mocha.run((failures: number) => {
      console.log(`[test-runner] done, failures=${failures}`);
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
