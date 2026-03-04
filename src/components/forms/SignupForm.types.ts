import * as v from "valibot";

// Individual field validators for field-specific validation
export const usernameValidator = v.pipe(
  v.string(),
  v.minLength(3, "Username must be at least 3 characters."),
  v.maxLength(30, "Username must be less than 30 characters."),
  v.regex(
    /^[a-zA-Z_.-]+$/,
    "Username can only contain letters, underscores, periods, and dashes."
  )
);

export const emailValidator = v.pipe(
  v.string(),
  v.email("Invalid email address.")
);

export const passwordValidator = v.pipe(
  v.string(),
  v.minLength(5, "Password must be at least 5 characters.")
);

export const SignupSchema = v.object({
  username: usernameValidator,
  email: emailValidator,
  password: passwordValidator,
});
