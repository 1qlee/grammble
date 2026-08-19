import { Suspense, lazy, useEffect, useState } from "react";
import type { ComponentProps } from "react";
import type AppDialogComponent from "./AppDialog";

// Headless UI's Dialog/Tabs (plus their react-aria deps) and every settings /
// subscription panel live behind this boundary, so none of it lands in the main
// chunk. Nav renders this on every page but the real dialog only mounts after
// the first open.
const AppDialog = lazy(() => import("./AppDialog"));

type Props = ComponentProps<typeof AppDialogComponent>;

export default function AppDialogLazy(props: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (props.isOpen) setMounted(true);
  }, [props.isOpen]);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <AppDialogGate {...props} />
    </Suspense>
  );
}

// Holds `isOpen` false for the commit in which the lazy chunk lands, so Headless
// UI sees a false -> true flip and still plays its enter transition. Effects in
// here don't run until the suspended child has resolved and committed.
function AppDialogGate(props: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return <AppDialog {...props} isOpen={props.isOpen && ready} />;
}
