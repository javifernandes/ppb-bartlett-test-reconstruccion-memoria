"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

const magicLinkErrorMessage = (code: string | undefined) => {
  switch (code) {
    case "over_email_send_rate_limit":
      return "Se alcanzó el límite de emails de Supabase. Esperá un rato antes de volver a intentar.";
    case "over_request_rate_limit":
      return "Hubo demasiados intentos. Esperá unos minutos antes de volver a intentar.";
    case "email_address_not_authorized":
      return "El servicio de correo de Supabase no autoriza esta dirección. Hay que configurar un SMTP propio.";
    case "otp_disabled":
      return "El acceso por magic link está deshabilitado en Supabase.";
    case "user_not_found":
      return "El email todavía no fue invitado como administrador.";
    default:
      return "No se pudo enviar el enlace. Verificá que el email haya sido invitado.";
  }
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
    console.error("Supabase rejected the magic link request", {
      code: error.code,
      status: error.status,
    });
    return {
      status: "error",
      message: magicLinkErrorMessage(error.code),
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
