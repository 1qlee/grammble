import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { PrismaClient } from "../prisma-generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const RECIPIENTS_FILE = resolve(
  import.meta.dirname,
  "lifetime-recipients.json",
);
const LOG_FILE = resolve(import.meta.dirname, "lifetime-invites-log.csv");
const DRY_RUN = process.argv.includes("--dry-run");
const SEND_DELAY_MS = 150;

const APP_URL =
  process.env.APP_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://grammble.com");

const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL;
if (!DRY_RUN && !SES_FROM_EMAIL) {
  console.error("SES_FROM_EMAIL is not set.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ses = new SESClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

type Status = "sent" | "dry-run" | "skipped-consumed" | "error";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function renderEmail(inviteUrl: string) {
  const subject = "Your Grammble lifetime invite";
  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #1a1a1a; color: #fff; padding: 20px; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px;">You're invited to Grammble</h1>
    </div>
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
      <p style="font-size: 16px;">You've been granted a <strong>lifetime</strong> premium account. Click below to claim it:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" style="display: inline-block; background-color: #3b82f6; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Claim lifetime access</a>
      </div>
      <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
      <p style="font-size: 12px; color: #999; word-break: break-all; background-color: #fff; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">${inviteUrl}</p>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">This invite is single-use. Sign up with any email you like; the invite will be consumed on signup.</p>
    </div>
    <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
      <p>&copy; ${new Date().getFullYear()} Grammble. All rights reserved.</p>
    </div>
  </body>
</html>`;
  const text = `You're invited to Grammble.

You've been granted a lifetime premium account. Claim it here:

${inviteUrl}

This invite is single-use.`;
  return { subject, html, text };
}

async function sendInvite(email: string, inviteUrl: string) {
  const { subject, html, text } = renderEmail(inviteUrl);
  const command = new SendEmailCommand({
    Source: SES_FROM_EMAIL!,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: { Data: text, Charset: "UTF-8" },
      },
    },
  });
  await ses.send(command);
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

async function main() {
  if (!existsSync(RECIPIENTS_FILE)) {
    console.error(`Recipients file not found: ${RECIPIENTS_FILE}`);
    console.error('Create it as a JSON array, e.g. ["alice@example.com"]');
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(RECIPIENTS_FILE, "utf-8"));
  if (!Array.isArray(raw) || raw.some((e) => typeof e !== "string")) {
    console.error("Recipients file must be a JSON array of email strings.");
    process.exit(1);
  }

  const emails = [
    ...new Set((raw as string[]).map((e) => e.trim().toLowerCase())),
  ].filter(Boolean);

  console.log(
    `Processing ${emails.length} recipient(s) against ${APP_URL}${DRY_RUN ? " (dry-run)" : ""}`,
  );

  const rows: Array<{
    email: string;
    token: string;
    inviteUrl: string;
    status: Status;
    sentAt: string;
    note: string;
  }> = [];

  for (const email of emails) {
    try {
      const existing = await prisma.invite.findUnique({ where: { email } });

      if (existing?.consumed) {
        console.log(`  skip  ${email}  already consumed`);
        rows.push({
          email,
          token: existing.token,
          inviteUrl: "",
          status: "skipped-consumed",
          sentAt: "",
          note: `consumedBy=${existing.consumedBy ?? ""}`,
        });
        continue;
      }

      const invite =
        existing ?? (await prisma.invite.create({ data: { email } }));
      const inviteUrl = `${APP_URL}/signup?invite=${invite.token}`;

      if (DRY_RUN) {
        console.log(`  dry   ${email}  ${inviteUrl}`);
        rows.push({
          email,
          token: invite.token,
          inviteUrl,
          status: "dry-run",
          sentAt: "",
          note: existing ? "existing-unconsumed" : "created",
        });
        continue;
      }

      await sendInvite(email, inviteUrl);
      const sentAt = new Date();
      await prisma.invite.update({
        where: { id: invite.id },
        data: { sentAt },
      });
      console.log(`  sent  ${email}`);
      rows.push({
        email,
        token: invite.token,
        inviteUrl,
        status: "sent",
        sentAt: sentAt.toISOString(),
        note: existing ? "resend" : "new",
      });
      await sleep(SEND_DELAY_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  fail  ${email}:`, message);
      rows.push({
        email,
        token: "",
        inviteUrl: "",
        status: "error",
        sentAt: "",
        note: message,
      });
    }
  }

  const header = "email,token,invite_url,status,sent_at,note";
  const body = rows
    .map((r) =>
      [r.email, r.token, r.inviteUrl, r.status, r.sentAt, r.note]
        .map(csvEscape)
        .join(","),
    )
    .join("\n");
  writeFileSync(LOG_FILE, `${header}\n${body}\n`);
  console.log(`Log written to ${LOG_FILE}`);

  const counts = rows.reduce<Record<Status, number>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {} as Record<Status, number>,
  );
  console.log("Summary:", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
