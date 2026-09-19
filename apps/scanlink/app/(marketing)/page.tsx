import Link from "next/link";
import { Button, Card, CardDescription, CardTitle, Container } from "@kch/ui";
import { appConfig } from "@/app.config";

export default function HomePage() {
  return (
    <>
      <section className="py-24 sm:py-32">
        <Container className="max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{appConfig.tagline}</h1>
          <p className="mt-6 text-lg text-muted-foreground">{appConfig.description}</p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">Get started free</Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                See pricing
              </Button>
            </Link>
          </div>
        </Container>
      </section>

      <section className="pb-24">
        <Container>
          <div className="grid gap-6 sm:grid-cols-3">
            {appConfig.features.map((f) => (
              <Card key={f.title}>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription className="mt-2">{f.description}</CardDescription>
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
