"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Logo } from "@/components/layout/logo";
import { auth } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import {
  loginSchema,
  registerSchema,
  type LoginValues,
  type RegisterValues,
} from "@/lib/validation/auth";
import type { SessionUser } from "@/lib/api/types";

type Mode = "login" | "register";

const copy = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to reach your data rooms.",
    submit: "Sign in",
    pending: "Signing in…",
    switchPrompt: "New here?",
    switchAction: "Create an account",
    switchHref: "/register",
  },
  register: {
    title: "Create your account",
    subtitle: "Set up a data room in under a minute.",
    submit: "Create account",
    pending: "Creating account…",
    switchPrompt: "Already have an account?",
    switchAction: "Sign in",
    switchHref: "/login",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const text = copy[mode];

  const form = useForm<LoginValues & Partial<RegisterValues>>({
    resolver: zodResolver(
      mode === "login" ? loginSchema : registerSchema,
    ) as never,
    defaultValues: { email: "", password: "", ...(mode === "register" ? { name: "" } : {}) },
  });

  const submit = useMutation({
    mutationFn: (values: LoginValues & Partial<RegisterValues>) =>
      mode === "login"
        ? auth.login({ email: values.email, password: values.password })
        : auth.register({
            email: values.email,
            password: values.password,
            name: values.name ?? "",
          }),
    onSuccess: (user: SessionUser) => {
      queryClient.setQueryData(queryKeys.session, user);
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
    },
    onError: (error) => {
      form.setError("root", { message: errorMessage(error) });
    },
  });

  const isPending = submit.isPending || form.formState.isSubmitting;

  return (
    <div className="w-full max-w-sm">
      <Logo className="mb-8 justify-center text-base" />

      <div className="bg-card rounded-xl border p-6 shadow-sm sm:p-8">
        <div className="mb-6 space-y-1.5 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{text.title}</h1>
          <p className="text-muted-foreground text-sm">{text.subtitle}</p>
        </div>

        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => submit.mutate(values))}
        >
          {mode === "register" && (
            <Field id="name" label="Name" error={form.formState.errors.name?.message}>
              <Input
                id="name"
                autoComplete="name"
                placeholder="Ada Lovelace"
                aria-invalid={Boolean(form.formState.errors.name)}
                disabled={isPending}
                {...form.register("name")}
              />
            </Field>
          )}

          <Field id="email" label="Email" error={form.formState.errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={Boolean(form.formState.errors.email)}
              disabled={isPending}
              {...form.register("email")}
            />
          </Field>

          <Field
            id="password"
            label="Password"
            error={form.formState.errors.password?.message}
            hint={mode === "register" ? "At least 8 characters." : undefined}
          >
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              aria-invalid={Boolean(form.formState.errors.password)}
              disabled={isPending}
              {...form.register("password")}
            />
          </Field>

          {form.formState.errors.root && (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
            >
              {form.formState.errors.root.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? text.pending : text.submit}
          </Button>
        </form>
      </div>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        {text.switchPrompt}{" "}
        <Link
          href={text.switchHref}
          className="text-foreground font-medium underline underline-offset-4"
        >
          {text.switchAction}
        </Link>
      </p>
    </div>
  );
}
