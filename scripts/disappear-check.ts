import { wrapMessage, unwrapMessage, isDisappearing } from "../src/lib/utils/disappear";

async function main() {
  const ctx = "19:abc_def@thread.v2";
  const wrapped = await wrapMessage(ctx, "secret <b>hi</b>", Date.now() + 30_000);
  console.assert(isDisappearing(wrapped), "should be detected as disappearing");
  console.assert(!wrapped.includes("secret"), "plaintext must not leak into the blob");

  const ok = await unwrapMessage(ctx, wrapped);
  console.assert(ok?.body === "secret <b>hi</b>", "round-trip body mismatch");

  const wrongCtx = await unwrapMessage("other-context", wrapped);
  console.assert(wrongCtx === null, "wrong context must fail closed (null)");

  const plain = await unwrapMessage(ctx, "just a normal message");
  console.assert(plain === null, "non-disappearing content returns null");

  console.log("disappear.ts sanity check passed");
}
main();
