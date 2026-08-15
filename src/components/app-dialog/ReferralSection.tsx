import { useState } from "react";
import { Copy, Check, LoaderCircle } from "lucide-react";
import Alert from "~/components/ui/Alert";
import Badge from "~/components/ui/Badge";
import Button from "~/components/buttons/Button";
import type { ReferralInfo } from "./AppDialog.types";

export default function ReferralSection({
  referral,
}: {
  referral: ReferralInfo | null;
}) {
  const [generating, setGenerating] = useState(false);
  const [referralCode, setReferralCode] = useState(referral?.code ?? null);
  const [maxRedemptions, setMaxRedemptions] = useState(
    referral?.maxRedemptions ?? null
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/trpc/billing.generateReferralCode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: {} }),
      });
      const data = await res.json();

      if (data?.error) {
        setError(
          data.error?.json?.message || "Failed to generate referral code."
        );
      } else {
        const result = data?.result?.data?.json;
        setReferralCode(result?.code ?? null);
        setMaxRedemptions(result?.maxRedemptions ?? null);
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="bg-accent p-4 rounded-lg">
      <p className="text-sm font-medium">Referral Code</p>
      <p className="text-xs text-accent mb-2">
        Share your referral code with friends to give them 3 months of free
        premium access.
      </p>

      {error && (
        <Alert type="error" className="mb-3">
          {error}
        </Alert>
      )}

      {referralCode ? (
        <div className="flex justify-between items-center gap-2">
          <Button
            onClick={handleCopy}
            className="flex items-center gap-2"
            title="Copy code"
          >
            <code className="text-sm">{referralCode}</code>
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 opacity-50" />
            )}
          </Button>
          {maxRedemptions && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 h-4">
              {maxRedemptions} uses left
            </Badge>
          )}
        </div>
      ) : (
        <Button onClick={handleGenerate} aria-disabled={generating}>
          {generating ? (
            <LoaderCircle className="animate-spin w-4 h-4" />
          ) : (
            "Generate Referral Code"
          )}
        </Button>
      )}
    </section>
  );
}
