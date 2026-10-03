"use client";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import "./inspector.css";

export function InspectorSelect({ label, value, options, onChange, disabled = false, className = "" }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; disabled?: boolean; className?: string;
}) {
  const known = options.some(option => option.value === value);
  const items = known ? options : [{ value, label: value ? `Custom · ${value}` : "Choose" }, ...options];
  return <Select.Root value={value} onValueChange={next => { if (next !== null) onChange(next); }} items={items} disabled={disabled}>
    <Select.Trigger aria-label={label} className={`ip-input ip-select ${className}`}>
      <Select.Value /><Select.Icon><ChevronDown size={13} /></Select.Icon>
    </Select.Trigger>
    <Select.Portal><Select.Positioner className="ip-positioner" sideOffset={6} alignItemWithTrigger={false}>
      <Select.Popup className="ip-popup ip-select-popup"><Select.List>
        {items.map(item => <Select.Item key={item.value} value={item.value} className="ip-option">
          <Select.ItemText>{item.label}</Select.ItemText><Select.ItemIndicator><Check size={13} /></Select.ItemIndicator>
        </Select.Item>)}
      </Select.List></Select.Popup>
    </Select.Positioner></Select.Portal>
  </Select.Root>;
}
