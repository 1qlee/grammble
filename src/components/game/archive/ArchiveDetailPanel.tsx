import { useEffect, useState } from "react";
import { Transition } from "@headlessui/react";
import ArchiveDetail from "./ArchiveDetail";
import type { ArchiveDay, ArchiveDayStatus } from "~/trpc/router";

interface ArchiveDetailPanelProps {
  day: ArchiveDay | null;
  today: string;
  onPlay?: (date: string, status: ArchiveDayStatus) => void;
}

// Cross-fades between days when the user picks a different cell: the current
// detail slides down and fades out, then the newly selected detail slides up
// from the bottom and fades in. `ArchiveDetail` stays purely presentational;
// the swap sequencing lives here.
export default function ArchiveDetailPanel({
  day,
  today,
  onPlay,
}: ArchiveDetailPanelProps) {
  const [displayed, setDisplayed] = useState<ArchiveDay | null>(day);
  const [show, setShow] = useState<boolean>(!!day);

  useEffect(() => {
    if (!day) {
      setShow(false);
      return;
    }
    // First selection or same day: show directly without a leave step.
    if (!displayed) {
      setDisplayed(day);
      setShow(true);
      return;
    }
    if (day.date === displayed.date) {
      setDisplayed(day);
      // Re-show in case a transient null (e.g. a mode-switch refetch) had just
      // hidden the panel; the same day returning should never stay hidden.
      setShow(true);
      return;
    }
    // Different day selected: leave the current detail first; the swap to the
    // new day happens in afterLeave, which re-triggers the enter transition.
    setShow(false);
  }, [day, displayed]);

  return (
    <Transition
      show={show}
      appear
      as="div"
      enter="transition duration-200 ease-out"
      enterFrom="opacity-0 translate-y-4"
      enterTo="opacity-100 translate-y-0"
      leave="transition duration-150 ease-in"
      leaveFrom="opacity-100 translate-y-0"
      leaveTo="opacity-0 translate-y-4"
      afterLeave={() => {
        if (day && day.date !== displayed?.date) {
          setDisplayed(day);
          setShow(true);
        } else if (!day) {
          setDisplayed(null);
        }
      }}
    >
      {displayed && (
        <ArchiveDetail
          day={displayed}
          isToday={displayed.date === today}
          onPlay={onPlay}
        />
      )}
    </Transition>
  );
}
