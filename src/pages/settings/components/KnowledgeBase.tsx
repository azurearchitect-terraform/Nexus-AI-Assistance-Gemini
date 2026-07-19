import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components";
import { FileTextIcon, TrashIcon, LoaderIcon } from "lucide-react";

interface Document {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export const KnowledgeBase = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await invoke<Document[]>("get_documents");
      setDocuments(docs);
    } catch (e) {
      console.error("Failed to load documents", e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const text = await file.text();
      await invoke("upload_document", {
        title: file.name,
        content: text,
      });
      await loadDocuments();
    } catch (e) {
      console.error("Failed to upload document", e);
    } finally {
      setIsLoading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_document", { id });
      await loadDocuments();
    } catch (e) {
      console.error("Failed to delete document", e);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-card">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold">Knowledge Base (Memory)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Upload resumes, company docs, or notes to give the AI long-term context.
          </p>
        </div>
        <div className="relative">
          <input
            type="file"
            accept=".txt,.md"
            onChange={handleFileUpload}
            disabled={isLoading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <Button size="sm" variant="secondary" disabled={isLoading} className="pointer-events-none">
            {isLoading ? <LoaderIcon className="w-4 h-4 animate-spin mr-2" /> : <FileTextIcon className="w-4 h-4 mr-2" />}
            Upload .txt
          </Button>
        </div>
      </div>

      {documents.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex justify-between items-center p-2 rounded bg-muted/50 text-xs">
              <span className="font-medium truncate max-w-[200px]">{doc.title}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                onClick={() => handleDelete(doc.id)}
              >
                <TrashIcon className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
