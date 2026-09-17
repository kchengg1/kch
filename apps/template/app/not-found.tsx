import Link from "next/link";
import { Button, Container } from "@kch/ui";

export default function NotFound() {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
      <Link href="/" className="mt-6">
        <Button variant="outline">Back home</Button>
      </Link>
    </Container>
  );
}
