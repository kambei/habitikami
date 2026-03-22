import * as React from "react"
import { Check } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"

interface CheckboxProps extends React.HTMLAttributes<HTMLDivElement> {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
}

export function Checkbox({ checked, onCheckedChange, disabled, className, ...props }: CheckboxProps) {
    return (
        <div
            className={cn(
                "group flex items-center justify-center w-6 h-6 rounded-md border-2 border-input ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
                checked ? "bg-primary border-primary" : "bg-transparent border-input hover:border-primary/50",
                className
            )}
            onClick={() => !disabled && onCheckedChange?.(!checked)}
            {...props}
        >
            <motion.div
                initial={false}
                animate={{ scale: checked ? 1 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
                <Check className="h-4 w-4 text-primary-foreground stroke-[3]" />
            </motion.div>
        </div>
    )
}
