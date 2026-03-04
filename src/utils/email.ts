import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { createServerFn } from "@tanstack/react-start";
import crypto from "node:crypto";
import { prismaClient } from "./prisma";
import * as v from "valibot";
import { emailValidator } from "~/components/forms/SignupForm.types";

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});
const AWS_SES_FROM_EMAIL = "noreply@gramgames.org";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailParams) {
  const toAddresses = Array.isArray(to) ? to : [to];

  const command = new SendEmailCommand({
    Source: AWS_SES_FROM_EMAIL,
    Destination: {
      ToAddresses: toAddresses,
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: html,
          Charset: "UTF-8",
        },
        ...(text && {
          Text: {
            Data: text,
            Charset: "UTF-8",
          },
        }),
      },
    },
    ...(replyTo && {
      ReplyToAddresses: [replyTo],
    }),
  });

  try {
    const response = await sesClient.send(command);
    console.log("Email sent successfully:", response.MessageId);
    return { success: true, messageId: response.MessageId };
  } catch (error: any) {
    console.error("Failed to send email:", error);

    // Provide more helpful error messages
    if (
      error?.Code === "InvalidClientTokenId" ||
      error?.Code === "SignatureDoesNotMatch"
    ) {
      const errorMessage =
        "AWS SES credentials are invalid or missing. " +
        "Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.";
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (error?.Code === "MessageRejected") {
      const errorMessage =
        `Email rejected by SES: ${error.message || "Unknown reason"}. ` +
        "Check that the sender email is verified in AWS SES.";
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Generic error
    const errorMessage = error?.message || "Failed to send email";
    throw new Error(errorMessage);
  }
}

/**
 * Core function to send verification email
 * This function generates a verification token, stores it in the database,
 * and sends an email with a verification link
 * Can be called directly from server-side code
 */
export async function sendVerificationEmail(email: string) {
  // Step 1: Generate a secure verification token
  const token = crypto.randomBytes(32).toString("hex");

  // Step 2: Set expiration time (24 hours from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  // Step 3: Store verification token in database
  // Delete any existing verification tokens for this email first
  await prismaClient.verification.deleteMany({
    where: {
      identifier: email,
    },
  });

  // Create new verification record
  await prismaClient.verification.create({
    data: {
      id: crypto.randomUUID(),
      identifier: email,
      value: token,
      expiresAt,
    },
  });

  // Step 4: Create verification URL (token only for privacy)
  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://grammble.com"
      : "http://localhost:3000";
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;

  // Step 5: Create email content
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
            <p>© ${new Date().getFullYear()} Grammble. All rights reserved.</p>
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

© ${new Date().getFullYear()} Grammble. All rights reserved.
    `.trim();

  // Step 6: Send the email
  try {
    await sendEmail({
      to: email,
      subject,
      html,
      text,
    });

    return {
      success: true,
      message: "Verification email sent successfully",
    };
  } catch (error) {
    console.error("Failed to send verification email:", error);
    // Clean up the verification record if email sending fails
    await prismaClient.verification.deleteMany({
      where: {
        identifier: email,
        value: token,
      },
    });
    throw new Error("Failed to send verification email");
  }
}

/**
 * Server function wrapper for sendVerificationEmail
 * This allows the function to be called from client components using useServerFn
 */
const sendVerificationEmailSchema = v.object({
  email: emailValidator,
});

export const sendVerificationEmailFn = createServerFn({ method: "POST" })
  .inputValidator(sendVerificationEmailSchema)
  .handler(async ({ data }) => {
    return await sendVerificationEmail(data.email);
  });
