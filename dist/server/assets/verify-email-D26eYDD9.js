import { a as createServerRpc, c as createServerFn } from "../server.js";
import * as v from "valibot";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "react/jsx-runtime";
import "@tanstack/react-router/ssr/server";
import "@tanstack/react-router";
const resendVerificationEmailFn_createServerFn_handler = createServerRpc("5d2e99dc465a0403fe1a005d75b073716eb2f5dc9e6d0e05f83f09c27e2fc19b", (opts, signal) => {
  return resendVerificationEmailFn.__executeServer(opts, signal);
});
const resendVerificationEmailFn = createServerFn({
  method: "POST"
}).inputValidator(v.object({
  email: v.pipe(v.string(), v.email())
})).handler(resendVerificationEmailFn_createServerFn_handler, async ({
  data
}) => {
  const {
    sendVerificationEmail
  } = await import("./email-CMSc4YY_.js").then((n) => n.a);
  return await sendVerificationEmail(data.email);
});
export {
  resendVerificationEmailFn_createServerFn_handler
};
