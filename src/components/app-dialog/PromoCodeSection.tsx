import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import Alert from "~/components/ui/Alert";
import Button from "~/components/buttons/Button";
import Input from "~/components/ui/forms/Input";

export default function PromoCodeSection() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleRedeem = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/trpc/billing.redeemPromo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { code: code.trim() } }),
      });
      const data = await res.json();

      if (data?.error) {
        const message =
          data.error?.json?.message ||
          data.error?.message ||
          "Invalid promo code.";
        setResult({ type: "error", message });
      } else {
        const promoType = data?.result?.data?.json?.type;
        if (promoType === "LIFETIME_FREE") {
          setResult({
            type: "success",
            message: "Lifetime premium activated! Refresh to see changes.",
          });
        } else if (promoType === "FREE_TRIAL") {
          setResult({
            type: "success",
            message:
              "Free trial activated! You have 3 months of premium access.",
          });
        } else if (promoType === "DISCOUNT") {
          setResult({
            type: "success",
            message: "Discount applied! Subscribe below to use it.",
          });
        }
        setCode("");
      }
    } catch {
      setResult({ type: "error", message: "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-accent p-4 rounded-lg">
      <p className="text-sm font-semibold mb-2">Promo Code</p>
      {result && (
        <Alert
          type={result.type === "success" ? "success" : "error"}
          className="mb-3"
        >
          {result.message}
        </Alert>
      )}
      <div className="flex gap-2 items-end">
        <Input
          type="text"
          placeholder="Enter code"
          value={code}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setCode(e.target.value)
          }
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter") handleRedeem();
          }}
          onFocus={() => {
            if (result?.type === "error") setResult(null);
          }}
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={handleRedeem}
          aria-disabled={loading || !code.trim()}
        >
          {loading ? (
            <LoaderCircle className="animate-spin w-4 h-4" />
          ) : (
            "Redeem"
          )}
        </Button>
      </div>
    </section>
  );
}
