import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">fewbie</h1>
      <p className="max-w-md text-center text-lg text-muted-foreground">
        Basic template: Next.js App Router + Tailwind CSS + shadcn/ui. Edit{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
          src/app/page.tsx
        </code>{" "}
        to start building.
      </p>
      <Button asChild>
        <a href="https://ui.shadcn.com/docs">shadcn/ui docs</a>
      </Button>
    </main>
  );
}
