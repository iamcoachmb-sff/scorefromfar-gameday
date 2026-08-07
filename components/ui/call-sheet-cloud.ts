import { createBrowserClient } from "@supabase/ssr";

export type CallSheetCategory =
  | "formation"
  | "motion"
  | "protection"
  | "play"
  | "runConcept"
  | "passConcept"
  | "front"
  | "blitz"
  | "coverage";

export type CloudCallSheetItem = {
  id: string;
  user_id: string;
  category: CallSheetCategory;
  name: string;
  metadata: Record<string, unknown>;
  favorite: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

export async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("No authenticated user.");
  }

  return user.id;
}

export async function loadCallSheetItems(): Promise<CloudCallSheetItem[]> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("call_sheet_items")
    .select(
      "id,user_id,category,name,metadata,favorite,sort_order,is_active,created_at,updated_at"
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CloudCallSheetItem[];
}

export async function addCallSheetItem(
  category: CallSheetCategory,
  name: string,
  sortOrder = 0
): Promise<CloudCallSheetItem> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error("Call-sheet item name cannot be empty.");
  }

  const { data, error } = await supabase
    .from("call_sheet_items")
    .insert({
      user_id: userId,
      category,
      name: normalizedName,
      sort_order: sortOrder,
      metadata: {},
      favorite: false,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CloudCallSheetItem;
}

export async function deleteCallSheetItem(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("call_sheet_items")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
