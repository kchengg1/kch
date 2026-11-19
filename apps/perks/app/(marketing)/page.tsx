import Link from "next/link";
import { Button, Card, CardDescription, CardTitle, Container } from "@kch/ui";
import { redirect } from "next/navigation";
import { appConfig } from "@/app.config";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  // Signed-in people have nothing to do here; send them to their dashboard.
  if (await getSession()) redirect("/dashboard");
  return (
    <>
      <section className="relative overflow-hidden py-20 sm:py-28">
        <Container className="max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3.5 py-1 text-xs font-semibold text-primary">
            Credit card benefits, offers &amp; points
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-6xl">
            {appConfig.tagline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {appConfig.description}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">Create your account</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Log in
              </Button>
            </Link>
          </div>
        </Container>
      </section>

      <section className="pb-24">
        <Container>
          <div className="grid gap-5 sm:grid-cols-3">
            {appConfig.features.map((f) => (
              <Card key={f.title} className="transition-colors hover:border-primary/30">
                <CardTitle className="text-base">{f.title}</CardTitle>
                <CardDescription className="mt-2">{f.description}</CardDescription>
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
