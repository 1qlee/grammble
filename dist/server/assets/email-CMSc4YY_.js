import { T as TSS_SERVER_FUNCTION, R as getServerFnById, c as createServerFn } from "../server.js";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import crypto from "node:crypto";
import { prismaClient } from "./prisma-CDBmz4-v.js";
import * as v from "valibot";
const createSsrRpc = (functionId) => {
  const url = "/_serverFn/" + functionId;
  const fn = async (...args) => {
    const serverFn = await getServerFnById(functionId);
    return serverFn(...args);
  };
  return Object.assign(fn, {
    url,
    functionId,
    [TSS_SERVER_FUNCTION]: true
  });
};
const usernameValidator = v.pipe(
  v.string(),
  v.minLength(3, "Username must be at least 3 characters."),
  v.maxLength(30, "Username must be less than 30 characters."),
  v.regex(
    /^[a-zA-Z_.-]+$/,
    "Username can only contain letters, underscores, periods, and dashes."
  )
);
const emailValidator = v.pipe(
  v.string(),
  v.email("Invalid email address.")
);
const passwordValidator = v.pipe(
  v.string(),
  v.minLength(8, "Password must be at least 8 characters.")
);
const SignupSchema = v.object({
  username: usernameValidator,
  email: emailValidator,
  password: passwordValidator
});
const sesClient = new SESClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
  }
});
const AWS_SES_FROM_EMAIL = process.env.SES_FROM_EMAIL;
if (!AWS_SES_FROM_EMAIL) {
  throw new Error("SES_FROM_EMAIL environment variable is not set");
}
async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo
}) {
  const toAddresses = Array.isArray(to) ? to : [to];
  const command = new SendEmailCommand({
    Source: AWS_SES_FROM_EMAIL,
    Destination: {
      ToAddresses: toAddresses
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: "UTF-8"
      },
      Body: {
        Html: {
          Data: html,
          Charset: "UTF-8"
        },
        ...text && {
          Text: {
            Data: text,
            Charset: "UTF-8"
          }
        }
      }
    },
    ...replyTo && {
      ReplyToAddresses: [replyTo]
    }
  });
  try {
    const response = await sesClient.send(command);
    console.log("Email sent successfully:", response.MessageId);
    return {
      success: true,
      messageId: response.MessageId
    };
  } catch (error) {
    console.error("Failed to send email:", error);
    if (error?.Code === "InvalidClientTokenId" || error?.Code === "SignatureDoesNotMatch") {
      const errorMessage2 = "AWS SES credentials are invalid or missing. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.";
      console.error(errorMessage2);
      throw new Error(errorMessage2);
    }
    if (error?.Code === "MessageRejected") {
      const errorMessage2 = `Email rejected by SES: ${error.message || "Unknown reason"}. Check that the sender email is verified in AWS SES.`;
      console.error(errorMessage2);
      throw new Error(errorMessage2);
    }
    const errorMessage = error?.message || "Failed to send email";
    throw new Error(errorMessage);
  }
}
async function sendVerificationEmail(email2) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = /* @__PURE__ */ new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  await prismaClient.verification.deleteMany({
    where: {
      identifier: email2
    }
  });
  await prismaClient.verification.create({
    data: {
      id: crypto.randomUUID(),
      identifier: email2,
      value: token,
      expiresAt
    }
  });
  const baseUrl = process.env.NODE_ENV === "development" ? "http://localhost:3000" : process.env.APP_URL || "http://localhost:3000";
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  const subject = "Verify your email address";
  const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #1a1a1a; color: #fff; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Welcome to Grammble!</h1>
          </div>
          <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Thank you for signing up! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="display: inline-block; background-color: #3b82f6; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Verify Email Address</a>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #999; word-break: break-all; background-color: #fff; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">${verificationUrl}</p>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">This link will expire in 24 hours.</p>
            <p style="font-size: 14px; color: #666; margin-top: 20px;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
          <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
            <p>© ${(/* @__PURE__ */ new Date()).getFullYear()} Grammble. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  const text = `
Welcome to Grammble!

Thank you for signing up! Please verify your email address by visiting the following link:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

© ${(/* @__PURE__ */ new Date()).getFullYear()} Grammble. All rights reserved.
    `.trim();
  try {
    await sendEmail({
      to: email2,
      subject,
      html,
      text
    });
    return {
      success: true,
      message: "Verification email sent successfully"
    };
  } catch (error) {
    console.error("Failed to send verification email:", error);
    await prismaClient.verification.deleteMany({
      where: {
        identifier: email2,
        value: token
      }
    });
    throw new Error("Failed to send verification email");
  }
}
const sendVerificationEmailSchema = v.object({
  email: emailValidator
});
const sendVerificationEmailFn_createServerFn_handler = createSsrRpc("290dc8063922e54e0c65c9c66369a6e9d5e879ba7d8d5cc0a758a33b161771fc");
createServerFn({
  method: "POST"
}).inputValidator(sendVerificationEmailSchema).handler(sendVerificationEmailFn_createServerFn_handler, async ({
  data
}) => {
  return await sendVerificationEmail(data.email);
});
const email = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  sendEmail,
  sendVerificationEmail
}, Symbol.toStringTag, { value: "Module" }));
export {
  SignupSchema as S,
  email as a,
  createSsrRpc as c,
  emailValidator as e,
  passwordValidator as p,
  sendVerificationEmail as s,
  usernameValidator as u
};
