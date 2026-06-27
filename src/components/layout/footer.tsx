import Link from "next/link";
import { FileText } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-border/50 text-muted-foreground border-t py-6 text-center text-sm">
      <p>
        Built by{" "}
        <a
          href="https://github.com/uwaizeuze/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Owais Ahmad
        </a>
        {" · "}
        <a
          href="https://github.com/uwaizeuze/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          GitHub
        </a>
        {" · "}
        <a
          href="https://www.linkedin.com/in/owais-ahmad-87093a225/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          LinkedIn
        </a>
      </p>
      <p className="mt-1 flex items-center justify-center gap-1.5">
        <FileText className="h-3.5 w-3.5" />
        Local-First Document Editor — House of Edtech Assignment 2
      </p>
    </footer>
  );
}
