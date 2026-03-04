import Button from "./Button";

export default function AuthButton({
  children,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof Button>) {
  return (
    <Button {...props} className="w-full">
      {children}
    </Button>
  );
}
