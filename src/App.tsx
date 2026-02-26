import { useState, ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import "./App.css";

const DEFAULT_MARKDOWN = `# Mark It Down

**Mark It Down** is a Markdown reader and editor designed to keep you focused on your text and thoughts.

[Markdown Writing Guide](/MarkdownGuide.md) - Learn the basic syntax here.`;

function App() {
  const [markdown, setMarkdown] = useState<string>(DEFAULT_MARKDOWN);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTOCVisible, setIsTOCVisible] = useState(false);

  const handleOpenFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Markdown',
          extensions: ['md', 'markdown', 'txt']
        }]
      });

      if (selected && typeof selected === 'string') {
        setLoading(true);
        const contents = await readTextFile(selected);
        setMarkdown(contents);
        setFilePath(selected);
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to open file:", error);
      setLoading(false);
    }
  };

  const handleEditorChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdown(e.target.value);
  };

  const fileName = filePath ? filePath.split('/').pop() : "Opening.md";

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden transition-colors duration-500 text-[#4c4f69] bg-[#eff1f5]">
      <main className="flex-1 flex overflow-hidden relative">
        {/* Content View */}
        <div className={`flex-1 overflow-y-auto ${isEditing ? 'flex' : 'p-10'}`}>
          {isEditing ? (
            <textarea
              className="flex-1 p-10 bg-[#eff1f5] text-[#4c4f69] font-mono text-base resize-none outline-none selection:bg-slate-500/10"
              value={markdown}
              onChange={handleEditorChange}
              placeholder="Start writing..."
              spellCheck={false}
              autoFocus
            />
          ) : (
            <div className="max-w-[720px] mx-auto markdown-body font-sans" style={{ fontSize: '16px' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdown}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* TOC Sidebar (Fixed) */}
        <div 
          className={`fixed right-0 top-0 bottom-0 w-64 p-8 pt-20 border-l z-40 transition-all duration-300 transform shadow-2xl overflow-y-auto bg-[#eff1f5]/95 border-[#dce0e8] text-[#4c4f69] 
          ${isTOCVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0 pointer-events-none'}`}
        >
          <div className="space-y-1">
            <button className="block w-full text-left py-1.5 hover:translate-x-1 transition-all text-xs opacity-60 hover:opacity-100 truncate font-bold">
              {fileName}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-4 py-1 flex items-center justify-between z-50 transition-colors bg-[#dce0e8] border-[#bac2de] text-[#6c6f85]">
        {/* Footer Left */}
        <div className="flex-1 flex items-center gap-4 text-[9px] font-bold tracking-widest uppercase">
          <span className="text-[#1e66f5]">{isEditing ? 'EDITING' : 'READING'}</span>
          <button 
            onClick={handleOpenFile} 
            className="text-[9px] font-bold opacity-60 hover:opacity-100 uppercase"
          >
            OPEN
          </button>
          <button 
            onClick={() => { setMarkdown(""); setFilePath(null); setIsEditing(true); }}
            className="text-[9px] font-bold opacity-60 hover:opacity-100 uppercase"
          >
            NEW
          </button>
        </div>

        {/* Footer Center */}
        <div className="flex-1 flex justify-center overflow-hidden">
          <span className="text-[9px] font-bold opacity-40 truncate px-4">
            [{fileName}]
          </span>
        </div>

        {/* Footer Right */}
        <div className="flex-1 flex items-center justify-end gap-3">
          <button 
            onClick={() => setIsTOCVisible(!isTOCVisible)}
            className={`text-[9px] font-bold transition-all ${isTOCVisible ? 'text-[#1e66f5]' : 'opacity-60'}`}
          >
            TOC
          </button>
          <button className="text-[9px] font-bold transition-all opacity-60">SETTINGS</button>
          <div className="flex items-center gap-3 ml-2">
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`text-[9px] font-bold ${isEditing ? 'text-[#1e66f5]' : 'opacity-60 hover:opacity-100'}`}
            >
              {isEditing ? 'PREVIEW' : 'EDIT'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
