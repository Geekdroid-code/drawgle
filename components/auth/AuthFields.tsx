import { ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthField({
  autoComplete,
  disabled,
  label,
  minLength,
  onChange,
  placeholder,
  type,
  value,
}: {
  autoComplete: string;
  disabled: boolean;
  label: string;
  minLength?: number;
  onChange: (value: string) => void;
  placeholder: string;
  type: string;
  value: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <Input
        autoComplete={autoComplete}
        className="h-11 rounded-2xl border-black/[0.08] bg-neutral-50 px-4 text-[13px] shadow-none placeholder:text-neutral-400 focus-visible:border-mk-accent/50 focus-visible:ring-4 focus-visible:ring-mk-accent/10"
        disabled={disabled}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        type={type}
        value={value}
      />
    </label>
  );
}

export function AuthSubmitButton({
  busy,
  children,
  disabled,
}: {
  busy: boolean;
  children: string;
  disabled: boolean;
}) {
  return (
    <Button
      className="group relative h-11 w-full overflow-hidden rounded-full border-0 bg-mk-accent pl-5 pr-12 text-[13px] font-semibold text-white shadow-none hover:bg-mk-accent-strong"
      disabled={disabled}
      type="submit"
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
      <span className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-mk-accent">
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Button>
  );
}
