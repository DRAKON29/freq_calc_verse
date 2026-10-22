import { RadioTower } from "lucide-react";

import { Logo } from "@/components/logo";
import { PropagationCalculator } from "@/components/rf/propagation-calculator";
import { ThemeToggle } from "@/components/theme-toggle";

export default function IndexPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RadioTower className="h-4 w-4" aria-hidden />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Калькулятор радиотрассы</div>
              <div className="hidden text-[11px] text-muted-foreground sm:block">
                потери, зона Френеля и бюджет линии с учётом рельефа
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <PropagationCalculator />
      </main>

      <footer className="mb-4 flex items-center justify-center">
        <div className="flex items-center rounded-xl bg-neutral-900 px-4 py-2 text-neutral-100">
          <Logo className="h-5 w-auto" />
        </div>
      </footer>
    </div>
  );
}
