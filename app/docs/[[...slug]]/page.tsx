import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMDXComponents } from "@/mdx-components";
import { docJsonLd, pageMetadata } from "@/lib/seo";
import { source } from "@/lib/source";

// The docs index is titled after the site itself; an absolute title keeps the
// tab from reading "robins.tools · robins.tools" and gives the page a distinct
// heading for search and social cards.
function resolveDocTitle(title: string): { title: string; isIndex: boolean } {
  if (title === "robins.tools") return { title: "robins.tools docs", isIndex: true };
  return { title, isIndex: false };
}

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const { title } = resolveDocTitle(page.data.title);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: docJsonLd({
            title,
            description: page.data.description ?? "",
            path: page.url,
          }),
        }}
      />
      <DocsPage toc={page.data.toc} full={page.data.full}>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody>
          <MDX components={getMDXComponents()} />
        </DocsBody>
      </DocsPage>
    </>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const { title, isIndex } = resolveDocTitle(page.data.title);
  const description = page.data.description ?? "";

  return pageMetadata({
    title,
    description,
    path: page.url,
    absoluteTitle: isIndex,
    ogTitle: isIndex ? "robins.tools docs" : `${page.data.title} · robins.tools`,
    ogType: "article",
  });
}
