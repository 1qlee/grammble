import { create } from "zustand";
import type { AppDialogTab } from "~/components/AppDialog";
import type { GameMode } from "~/utils/game/constants";

interface AppDialogState {
  isOpen: boolean;
  tab: AppDialogTab;
  // Set when the dialog is opened from a locked game mode tab, so the
  // subscription upsell can tailor its copy to that mode.
  upsellMode: GameMode | null;
  open: (tab?: AppDialogTab, upsellMode?: GameMode | null) => void;
  close: () => void;
}

// Shared control for the global AppDialog (settings/subscription). Rendered
// once in Nav, but openable from anywhere (e.g. the premium upsell when a
// non-premium user picks a locked game mode).
export const useAppDialogStore = create<AppDialogState>((set) => ({
  isOpen: false,
  tab: "settings",
  upsellMode: null,
  open: (tab = "settings", upsellMode = null) =>
    set({ isOpen: true, tab, upsellMode }),
  // Keep `upsellMode` set through the dialog's exit animation; clearing it here
  // would flash the copy back to default before the dialog unmounts. The next
  // `open()` always resets it explicitly.
  close: () => set({ isOpen: false }),
}));
