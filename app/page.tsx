import type { Metadata } from "next";

import { BottomCta } from "@/components/landing/bottom-cta";
import { Hero } from "@/components/landing/hero";
import { Principles } from "@/components/landing/principles";
import { ToolShowcase } from "@/components/landing/tool-showcase";
import {
  SITE_DESCRIPTION,
  SITE_TITLE_DEFAULT,
  landingJsonLd,
  pageMetadata,
} from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: SITE_TITLE_DEFAULT,
  absoluteTitle: true,
  ogTitle: SITE_TITLE_DEFAULT,
  description: SITE_DESCRIPTION,
  path: "/",
});

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: landingJsonLd() }}
      />
      <Hero />
      <ToolShowcase />
      <Principles />
      <BottomCta />
    </>
  );
}
