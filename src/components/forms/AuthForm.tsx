import clsx from "clsx";

export default function AuthForm(
  props: React.FormHTMLAttributes<HTMLFormElement>
) {
  return (
    <div className="card-wrapper bg-default shadow-default">
      <form className={clsx("card", props.className)} {...props}></form>
    </div>
  );
}
