'use client'
import * as RadixSelect from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export const SelectRoot = RadixSelect.Root
export const SelectValue = RadixSelect.Value

export function Select({ children, ...props }: RadixSelect.SelectProps & { children: React.ReactNode }) {
  return <RadixSelect.Root {...props}>{children}</RadixSelect.Root>
}

export function SelectTrigger({ className, children, ...props }: RadixSelect.SelectTriggerProps) {
  return (
    <RadixSelect.Trigger
      className={cn(
        'flex items-center justify-between w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
        className
      )}
      {...props}
    >
      {children}
      <RadixSelect.Icon><ChevronDown size={14} /></RadixSelect.Icon>
    </RadixSelect.Trigger>
  )
}

export function SelectContent({ className, children, ...props }: RadixSelect.SelectContentProps) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        className={cn(
          'z-50 rounded-md border border-[var(--border)] bg-[var(--popover)] shadow-lg p-1 min-w-[8rem]',
          className
        )}
        position="popper"
        sideOffset={4}
        {...props}
      >
        <RadixSelect.Viewport>{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  )
}

export function SelectItem({ className, children, ...props }: RadixSelect.SelectItemProps) {
  return (
    <RadixSelect.Item
      className={cn(
        'relative flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm cursor-default select-none',
        'text-[var(--foreground)] hover:bg-[var(--accent)] focus:bg-[var(--accent)] outline-none',
        className
      )}
      {...props}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="absolute right-2">
        <Check size={12} />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  )
}
