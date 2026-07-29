import assert from "node:assert/strict";
import test from "node:test";

import { scaledDimensions } from "./image-compression";

void test("an image inside the limit is left at its own size", () => {
  assert.deepEqual(scaledDimensions(1600, 900, 2400), {
    width: 1600,
    height: 900,
  });
  assert.deepEqual(scaledDimensions(2400, 2400, 2400), {
    width: 2400,
    height: 2400,
  });
});

void test("the longest edge decides, whichever edge that is", () => {
  assert.deepEqual(scaledDimensions(4800, 2400, 2400), {
    width: 2400,
    height: 1200,
  });
  assert.deepEqual(scaledDimensions(2400, 4800, 2400), {
    width: 1200,
    height: 2400,
  });
});

void test("a very narrow image keeps at least one pixel of its short edge", () => {
  assert.deepEqual(scaledDimensions(10000, 3, 2400), {
    width: 2400,
    height: 1,
  });
});

void test("a zero-sized bitmap is not divided by", () => {
  assert.deepEqual(scaledDimensions(0, 0, 2400), { width: 0, height: 0 });
});
