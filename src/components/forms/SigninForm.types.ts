import * as v from "valibot";

export const SigninSchema = v.object({
  usernameOrEmail: v.string(),
  password: v.pipe(v.string(), v.minLength(1, "Password is required.")),
});
