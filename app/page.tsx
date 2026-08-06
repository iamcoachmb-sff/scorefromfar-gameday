import { redirect } from "next/navigation";
import CallSheetApp from "@/components/callsheetapp";
import { createClient } from "./supabase-server";

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <CallSheetApp />;
}
