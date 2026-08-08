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

export type LibraryItem = {
  id: string;
  name: string;
  favorite: boolean;
  metadata: Record<string, unknown>;
  sortOrder: number;
};

export type CloudLibraries = Record<
  CallSheetCategory,
  LibraryItem[]
>;

function createEmptyLibraries(): CloudLibraries {
  return {
    formation: [],
    motion: [],
    protection: [],
    play: [],
    runConcept: [],
    passConcept: [],
    front: [],
    blitz: [],
    coverage: [],
  };
}

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

async function getCurrentUserId(): Promise<string> {
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

export async function loadCloudCallSheetItems(): Promise<
  CloudCallSheetItem[]
> {
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

export async function loadCloudLibraries(): Promise<CloudLibraries> {
  const items = await loadCloudCallSheetItems();
  const libraries = createEmptyLibraries();

  for (const item of items) {
    if (!(item.category in libraries)) {
      continue;
    }

    libraries[item.category].push({
      id: item.id,
      name: item.name,
      favorite: item.favorite,
      metadata: item.metadata ?? {},
      sortOrder: item.sort_order,
    });
  }

  return libraries;
}

export async function addCloudCallSheetItem(
  category: CallSheetCategory,
  name: string,
  sortOrder = 0,
  metadata: Record<string, unknown> = {},
  favorite = false
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
      metadata,
      favorite,
      sort_order: sortOrder,
      is_active: true,
    })
    .select(
      "id,user_id,category,name,metadata,favorite,sort_order,is_active,created_at,updated_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CloudCallSheetItem;
}

export async function updateCloudCallSheetItem(
  id: string,
  changes: {
    name?: string;
    favorite?: boolean;
    sort_order?: number;
    metadata?: Record<string, unknown>;
    is_active?: boolean;
  }
): Promise<CloudCallSheetItem> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const updatePayload = {
    ...changes,
    ...(typeof changes.name === "string"
      ? { name: changes.name.trim() }
      : {}),
  };

  if (
    typeof updatePayload.name === "string" &&
    !updatePayload.name
  ) {
    throw new Error("Call-sheet item name cannot be empty.");
  }

  const { data, error } = await supabase
    .from("call_sheet_items")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", userId)
    .select(
      "id,user_id,category,name,metadata,favorite,sort_order,is_active,created_at,updated_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CloudCallSheetItem;
}

export async function deleteCloudCallSheetItem(
  id: string
): Promise<void> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("call_sheet_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export function getEmptyCloudLibraries(): CloudLibraries {
  return createEmptyLibraries();
}
