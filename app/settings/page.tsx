import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";
import BackLink from "./BackLink";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <BackLink />
      <h1 className="font-display text-xl font-semibold text-ink">
        Settings
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Add your own API keys to keep generating designs and finding
        products if the app&apos;s shared keys run out of free quota. Your
        keys are private to your account and only ever used for your own
        requests.
      </p>
      <div className="mt-8">
        <SettingsForm />
      </div>
    </div>
  );
}