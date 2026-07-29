import assert from "node:assert/strict";
import test from "node:test";

import { isPrefetchRequest } from "./prefetch-request";

void test("a real navigation is not a prefetch", () => {
  assert.equal(isPrefetchRequest(new Headers()), false);
  assert.equal(
    isPrefetchRequest(new Headers({ rsc: "1", accept: "text/x-component" })),
    false,
  );
});

void test("the router's own prefetch is recognised whatever its value", () => {
  assert.equal(
    isPrefetchRequest(new Headers({ "next-router-prefetch": "1" })),
    true,
  );
  assert.equal(
    isPrefetchRequest(new Headers({ "Next-Router-Prefetch": "true" })),
    true,
  );
});

void test("a browser prefetching on its own is recognised too", () => {
  for (const name of ["purpose", "x-purpose", "x-moz"]) {
    assert.equal(isPrefetchRequest(new Headers({ [name]: "prefetch" })), true);
    assert.equal(
      isPrefetchRequest(new Headers({ [name]: " Prefetch " })),
      true,
    );
  }
});

void test("a purpose that is not prefetching is a real read", () => {
  // Chrome sends `Purpose: preview` for other speculative work, and Safari
  // sends nothing at all; only the word `prefetch` suppresses a read event.
  assert.equal(isPrefetchRequest(new Headers({ purpose: "preview" })), false);
  assert.equal(isPrefetchRequest(new Headers({ purpose: "" })), false);
});
