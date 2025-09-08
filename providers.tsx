"use client";

import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() => supabase);

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      {children}
    </SessionContextProvider>
  );
}
