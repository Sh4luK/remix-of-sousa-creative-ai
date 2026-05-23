import { Toaster as Sonner } from "sonner";

const Toaster = () => (
  <Sonner
    richColors
    position="top-right"
    toastOptions={{
      classNames: {
        toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
        description: "group-[.toast]:text-muted-foreground",
      },
    }}
  />
);

export { Toaster };
