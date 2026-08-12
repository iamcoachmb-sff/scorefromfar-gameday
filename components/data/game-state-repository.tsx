import { createBrowserClient } from "@supabase/ssr";

export type CloudGameState = {
  user_id: string;
  plays: unknown[];
  form: Record<string, unknown>;
  undo_history: unknown[];
  test_dataset_meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type SaveGameStateInput = {
  plays: unknown[];
  form: Record<string, unknown>;
  undoHistory: unknown[];
  testDatasetMeta?: Record<string, unknown> | null;
};

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

export async function loadCloudGameState(): Promise<CloudGameState | null> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("game_state")
    .select(
      "user_id,plays,form,undo_history,test_dataset_meta,created_at,updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as CloudGameState | null) ?? null;
}

export async function saveCloudGameState(
  state: SaveGameStateInput
): Promise<CloudGameState> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("game_state")
    .upsert(
      {
        user_id: userId,
        plays: state.plays,
        form: state.form,
        undo_history: state.undoHistory,
        test_dataset_meta: state.testDatasetMeta ?? null,
      },
      { onConflict: "user_id" }
    )
    .select(
      "user_id,plays,form,undo_history,test_dataset_meta,created_at,updated_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CloudGameState;
}

export async function clearCloudGameState(): Promise<void> {
  await saveCloudGameState({
    plays: [],
    form: {},
    undoHistory: [],
    testDatasetMeta: null,
  });
}
