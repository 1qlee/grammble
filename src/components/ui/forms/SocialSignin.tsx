import GoogleSigninButton from "~/components/buttons/GoogleSigninButton";
import TwitterSigninButton from "~/components/buttons/TwitterSigninButton";
import DiscordSigninButton from "~/components/buttons/DiscordSigninButton";

export default function SocialSignin() {
  return (
    <div>
      <div className="relative my-4">
        <span className="border-t-1 border-zinc-200 dark:border-zinc-600 w-[30%] absolute top-1/2 left-0 -translate-y-1/2 z-0"></span>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 relative z-10 py-2 px-4 rounded-full text-center w-fit mx-auto">
          Or continue with
        </div>
        <span className="border-t-1 border-zinc-200 dark:border-zinc-600 w-[30%] absolute top-1/2 right-0 -translate-y-1/2 z-0"></span>
      </div>
      <div className="flex gap-2">
        <GoogleSigninButton />
        <TwitterSigninButton />
        <DiscordSigninButton />
      </div>
    </div>
  );
}
