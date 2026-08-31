import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicBrowser } from "@/components/public/public-browser";

export const metadata: Metadata = {
  title: "Shared documents · Data Room",
  // A shared link should not end up in search results.
  robots: { index: false, follow: false },
};

export default async function PublicSharePage({
  params,
}: PageProps<"/public/[token]">) {
  const { token } = await params;

  return (
    <Suspense>
      <PublicBrowser token={token} />
    </Suspense>
  );
}
