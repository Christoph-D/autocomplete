import * as assert from "assert";
import { createDebouncer } from "../../src/completion/debounce";

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

suite("createDebouncer", () => {
  test("fires after the delay with the latest value", async () => {
    let calls = 0;
    let last = "";
    const deb = createDebouncer<string>(30, async (v) => {
      calls++;
      last = v;
    });
    deb.run("a");
    deb.run("b");
    deb.run("c");
    await wait(80);
    assert.strictEqual(calls, 1);
    assert.strictEqual(last, "c");
    deb.dispose();
  });

  test("cancel() prevents the pending call", async () => {
    let calls = 0;
    const deb = createDebouncer<number>(20, async () => {
      calls++;
    });
    deb.run(1);
    deb.cancel();
    await wait(60);
    assert.strictEqual(calls, 0);
    deb.dispose();
  });

  test("setDelay changes the trailing delay", async () => {
    let calls = 0;
    const deb = createDebouncer<void>(100, async () => {
      calls++;
    });
    deb.setDelay(20);
    deb.run(undefined);
    await wait(60);
    assert.strictEqual(calls, 1);
    deb.dispose();
  });

  test("aborts the signal of a superseded call", async () => {
    const aborted: boolean[] = [];
    const deb = createDebouncer<string>(20, async (_v, signal) => {
      aborted.push(signal.aborted);
    });
    deb.run("first");
    deb.run("second");
    await wait(60);
    assert.deepStrictEqual(aborted, [false]);
    deb.dispose();
  });

  test("does not fire when disposed before delay elapses", async () => {
    let calls = 0;
    const deb = createDebouncer<number>(20, async () => {
      calls++;
    });
    deb.run(1);
    deb.dispose();
    await wait(60);
    assert.strictEqual(calls, 0);
  });
});
