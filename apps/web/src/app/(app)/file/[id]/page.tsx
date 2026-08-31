import { FileViewer } from "@/components/files/file-viewer";

export default async function FilePage({ params }: PageProps<"/file/[id]">) {
  const { id } = await params;
  return <FileViewer fileId={id} />;
}
