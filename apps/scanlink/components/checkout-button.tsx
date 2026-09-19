import Link from "next/link";
import { Button } from "@kch/ui";
import { startCheckout } from "@/app/dashboard/billing/actions";

/**
 * Server-action form. Signed-out users are sent to signup with a return path
 * so checkout resumes right after they create an account.
 */
export function CheckoutButton({
  planId,
  signedIn,
  disabled,
}: {
  planId: string;
  signedIn: boolean;
  disabled?: boolean;
}) {
  if (!signedIn) {
    return (
      <Link
        href={{ pathname: "/signup", query: { next: `/pricing?checkout=${planId}` } }}
        className="block"
      >
        <Button className="w-full" disabled={disabled}>
          Get started
        </Button>
      </Link>
    );
  }
  return (
    <form action={startCheckout}>
      <input type="hidden" name="planId" value={planId} />
      <Button type="submit" className="w-full" disabled={disabled}>
        {disabled ? "Current plan" : "Choose plan"}
      </Button>
    </form>
  );
}
