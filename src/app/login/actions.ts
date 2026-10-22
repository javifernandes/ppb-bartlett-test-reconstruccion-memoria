"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

export const requestMagicLink = async (
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> => {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = String(formData.get("next") ?? "/");
  if (!email) return { status: "error", message: "Ingresá tu email." };

  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (!origin)
    return { status: "error", message: "No se pudo determinar la URL." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next.startsWith("/") ? next : "/")}`,
    },
  });

  if (error) {
    return {
      status: "error",
      message:
        "No se pudo enviar el enlace. Verificá que el email haya sido invitado.",
    };
  }

  return {
    status: "sent",
    message: "Te enviamos un enlace para ingresar. Revisá también spam.",
  };
};

export const signOut = async () => {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
};
