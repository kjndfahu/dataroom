import { BrowserView } from "@/components/browser/browser-view";

export default async function DataRoomPage({ params }: PageProps<"/dataroom/[id]">) {
  const { id } = await params;
  return <BrowserView dataRoomId={id} folderId={null} />;
}
