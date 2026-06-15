import {
  Popover as HeadlessPopover,
  PopoverButton as HeadlessPopoverButton,
  PopoverPanel as HeadlessPopoverPanel,
} from "@headlessui/react";
import Button from "~/components/buttons/Button";

type PopoverProps = {
  children: React.ReactNode;
  button: React.ReactNode;
  size?: "sm" | "md" | "lg";
};

export default function Popover({ children, button, size }: PopoverProps) {
  return (
    <HeadlessPopover className="relative">
      <HeadlessPopoverButton className="" as={Button} size={size}>
        {button}
      </HeadlessPopoverButton>
      <HeadlessPopoverPanel className="w-[300px] bg-default-shadow p-2 rounded-lg absolute top-[calc(100%+16px)] right-[-16px] flex flex-col gap-2">
        {children}
      </HeadlessPopoverPanel>
    </HeadlessPopover>
  );
}
