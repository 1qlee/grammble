import { redirect, createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { signOut } from "~/utils/auth/auth-client";

// const logoutFn = createServerFn().handler(async () => {
//   const session = await useAppSession()

//   session.clear()

//   throw redirect({
//     href: '/',
//   })
// })

export const Route = createFileRoute("/logout")({
  preload: false,
  loader: () => signOut(),
});
