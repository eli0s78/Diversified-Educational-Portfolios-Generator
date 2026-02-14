import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/lib/i18n/routing";
import Navbar from "@/components/layout/Navbar";
import { ProjectProvider } from "@/lib/project-context";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ProjectProvider>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
            <p>
              Diversified Educational Portfolios Generator &mdash; Based on
              Kanzola &amp; Petrakis (2024)
            </p>
          </footer>
        </div>
      </ProjectProvider>
    </NextIntlClientProvider>
  );
}
