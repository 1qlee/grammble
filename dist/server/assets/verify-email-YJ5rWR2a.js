import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { a as createServerRpc, c as createServerFn } from "../server.js";
import * as v from "valibot";
import { A as Alert, a as Badge, L as Label, I as Input, B as Button } from "./Label-wLCwUdwb.js";
import { createFileRoute, Link } from "@tanstack/react-router";
import { F as Field } from "./Field-pfU_G4QI.js";
import { useState } from "react";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "@tanstack/react-router/ssr/server";
import "clsx";
import "@headlessui/react";
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
const verifyTokenSchema = v.object({
  token: v.optional(v.string())
});
const verifyEmailFn_createServerFn_handler = createServerRpc("3ca53f453041cc086031d37e1b534f81559d29e55683f5c04d0dcdd5cfa0edf5", (opts, signal) => {
  return verifyEmailFn.__executeServer(opts, signal);
});
const verifyEmailFn = createServerFn({
  method: "POST"
}).inputValidator(verifyTokenSchema).handler(verifyEmailFn_createServerFn_handler, async ({
  data
}) => {
  const {
    prismaClient
  } = await import("./prisma-CDBmz4-v.js");
  const token = data.token;
  if (!token) {
    return {
      success: false,
      message: "We couldn't verify your email. Please try clicking the link in your email again."
    };
  }
  const verification = await prismaClient.verification.findFirst({
    where: {
      value: token
    }
  });
  if (!verification) {
    return {
      success: false,
      message: "Invalid or expired verification link."
    };
  }
  if (/* @__PURE__ */ new Date() > verification.expiresAt) {
    await prismaClient.verification.delete({
      where: {
        id: verification.id
      }
    });
    return {
      success: false,
      message: "This verification link has expired."
    };
  }
  const email = verification.identifier;
  const user = await prismaClient.user.findUnique({
    where: {
      email
    }
  });
  if (!user) {
    return {
      success: false,
      message: "We couldn't find an account associated with this email. Please try signing up again."
    };
  }
  if (user.emailVerified) {
    await prismaClient.verification.delete({
      where: {
        id: verification.id
      }
    });
    return {
      success: true,
      message: "Your email has already been verified."
    };
  }
  await prismaClient.user.update({
    where: {
      id: user.id
    },
    data: {
      emailVerified: true
    }
  });
  await prismaClient.verification.delete({
    where: {
      id: verification.id
    }
  });
  return {
    success: true,
    message: "Your email has been successfully verified!"
  };
});
const Route = createFileRoute("/verify-email")({
  validateSearch: (search) => v.parse(verifyTokenSchema, search),
  loaderDeps: ({
    search: {
      token
    }
  }) => ({
    token
  }),
  preload: false,
  staleTime: Infinity,
  gcTime: 0,
  loader: async ({
    deps: {
      token
    }
  }) => {
    if (!token) {
      return {
        success: false,
        message: "Verification token is required. Please check your email for the complete verification link."
      };
    }
    return await verifyEmailFn({
      data: {
        token
      }
    });
  },
  component: VerifyEmailComp
});
function VerifyEmailComp() {
  const result = Route.useLoaderData();
  const [resendEmail, setResendEmail] = useState("");
  const [resendState, setResendState] = useState("idle");
  const [resendMessage, setResendMessage] = useState(null);
  const handleResend = async () => {
    if (!resendEmail || resendState === "loading") return;
    setResendState("loading");
    setResendMessage(null);
    try {
      await resendVerificationEmailFn({
        data: {
          email: resendEmail
        }
      });
      setResendState("success");
      setResendMessage("Verification email sent. Please check your inbox.");
    } catch {
      setResendState("error");
      setResendMessage("Failed to send verification email. Please try again.");
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "card-wrapper bg-default-shadow", children: result.success ? /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(Alert, { type: "success", className: "mb-6", children: [
      /* @__PURE__ */ jsx(Badge, { children: "Email Verified!" }),
      /* @__PURE__ */ jsx("p", { className: "text-lg", children: result.message })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-4", children: [
      /* @__PURE__ */ jsx(Link, { to: "/dashboard", className: "inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors", children: "Go to Dashboard" }),
      /* @__PURE__ */ jsx("div", { className: "text-sm text-gray-600 dark:text-gray-400", children: /* @__PURE__ */ jsx(Link, { to: "/", className: "text-blue-600 hover:underline", children: "Return to home" }) })
    ] })
  ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Alert, { type: "error", className: "mb-6", children: /* @__PURE__ */ jsx("p", { children: result.message }) }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-4", children: [
      /* @__PURE__ */ jsx("p", { className: "dark:text-gray-100", children: "Request a new verification email below." }),
      resendMessage && /* @__PURE__ */ jsx(Alert, { type: resendState === "success" ? "success" : "error", children: /* @__PURE__ */ jsx("p", { children: resendMessage }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 w-full items-end", children: [
        /* @__PURE__ */ jsxs(Field, { children: [
          /* @__PURE__ */ jsx(Label, { children: "Email" }),
          /* @__PURE__ */ jsx(Input, { type: "email", placeholder: "Enter your email", value: resendEmail, onChange: (e) => setResendEmail(e.target.value), disabled: resendState === "loading" || resendState === "success" })
        ] }),
        /* @__PURE__ */ jsx(Button, { type: "button", onClick: handleResend, "aria-disabled": resendState === "loading" || resendState === "success", children: resendState === "loading" ? "Sending..." : "Send" })
      ] }),
      /* @__PURE__ */ jsx(Link, { to: "/signin", children: "Sign In" }),
      /* @__PURE__ */ jsx("div", { className: "text-sm text-gray-600 dark:text-gray-400", children: /* @__PURE__ */ jsx(Link, { to: "/", className: "text-blue-600 hover:underline", children: "Return to home" }) })
    ] })
  ] }) });
}
export {
  resendVerificationEmailFn_createServerFn_handler,
  verifyEmailFn_createServerFn_handler
};
