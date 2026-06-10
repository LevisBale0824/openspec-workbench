import { OpenFile } from "../../stores/editor";
import { CodeEditor } from "./CodeEditor";
import { MarkdownPreview } from "./MarkdownPreview";

export function EditorContent({ file }: { file: OpenFile }) {
  if (file.isMarkdown) {
    return <MarkdownPreview file={file} />;
  }
  return <CodeEditor file={file} />;
}
