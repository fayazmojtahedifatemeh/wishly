import { Palette } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const themes = [
  { value: "light", label: "Light", color: "bg-gray-100" },
  { value: "dark", label: "Dark", color: "bg-gray-800" },
  { value: "pink", label: "Pink", color: "bg-pink-300" },
  { value: "blue", label: "Blue", color: "bg-blue-300" },
  { value: "green", label: "Green", color: "bg-green-300" },
  { value: "orange", label: "Orange", color: "bg-orange-300" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-theme-toggle"
        >
          <Palette className="h-5 w-5" />
          <span className="sr-only">Select theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {themes.map(({ value, label, color }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value as any)}
            data-testid={`theme-${value}`}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className={`w-4 h-4 rounded-full ${color} border border-border`} />
            <span className={theme === value ? "font-semibold" : ""}>
              {label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
