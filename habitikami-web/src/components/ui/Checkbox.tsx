import * as React from "react"
import { Check } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"

interface CheckboxProps extends React.HTMLAttributes<HTMLDivElement> {
    checked?: boolean | 'half'
    onCheckedChange?: (checked: boolean | 'half') => void
    disabled?: boolean
}

export function Checkbox({ checked, onCheckedChange, disabled, className, ...props }: CheckboxProps) {
    const isHalf = checked === 'half';
    const isChecked = checked === true;

    return (
        <div
            className={cn(
                "group flex items-center justify-center w-6 h-6 rounded-md border-2 border-input ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer overflow-hidden",
                isChecked ? "bg-primary border-primary" : "bg-transparent border-input hover:border-primary/50",
                isHalf && "border-primary",
                className
            )}
            style={{
                background: isHalf ? 'linear-gradient(to bottom right, hsl(var(--primary)) 50%, transparent 50%)' : undefined,
                ...props.style
            }}
            onClick={() => !disabled && onCheckedChange?.(isChecked ? false : (isHalf ? false : true))}
            {...props}
        >
            <motion.div
                initial={false}
                animate={{ scale: isChecked ? 1 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
                <Check className="h-4 w-4 text-primary-foreground stroke-[3]" />
            </motion.div>
        </div>
    )
}
