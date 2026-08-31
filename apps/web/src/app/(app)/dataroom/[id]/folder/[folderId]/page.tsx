import { BrowserView } from "@/components/browser/browser-view";

export default async function FolderPage({
  params,
}: PageProps<"/dataroom/[id]/folder/[folderId]">) {
  const { id, folderId } = await params;
  return <BrowserView dataRoomId={id} folderId={folderId} />;
}
