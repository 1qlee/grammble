import { createFileRoute } from "@tanstack/react-router";
import Guesses from "~/components/Guesses";
import Keyboard from "~/components/keyboard/Keyboard";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="flex flex-col justify-between h-[calc(100svh-128px)]">
      <Guesses />
      <Keyboard />
    </div>
  );
}
