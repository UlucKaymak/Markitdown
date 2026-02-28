import { useState, ChangeEvent, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { 
  Plus, Minus, Bold, Italic, List, Code, Link, Table, 
  Indent, PenLine, Columns2, Eye, Link2, FileImage, X, ChevronUp, ChevronDown
} from "lucide-react";
import markdownGuide from "./MarkdownGuide.md?raw";
import openingMd from "./Opening.md?raw";
import "./App.css";

const DEFAULT_MARKDOWN = openingMd;

type Theme = 'light' | 'dark' | 'dim';
type FontFamily = 'sans' | 'serif' | 'mono';
type ViewMode = 'editing' | 'split' | 'reading';

const ACCENT_COLORS = [
  { name: 'blue', light: '#1e66f5', dark: '#89b4fa' },
  { name: 'green', light: '#40a02b', dark: '#a6e3a1' },
  { name: 'mauve', light: '#8839ef', dark: '#cba6f7' },
  { name: 'flamingo', light: '#dd7878', dark: '#f2cdcd' },
  { name: 'peach', light: '#fe640b', dark: '#fab387' },
];

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];

function App() {
  const [markdown, setMarkdown] = useState<string>(DEFAULT_MARKDOWN);
  const [savedMarkdown, setSavedMarkdown] = useState<string>(DEFAULT_MARKDOWN);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('reading');
  const [isTOCVisible, setIsTOCVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isSyncScroll, setIsSyncScroll] = useState(true);
  
  // Find & Replace State
  const [isFindVisible, setIsFindVisible] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [findResults, setFindResults] = useState<number[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const activeSide = useRef<'editor' | 'preview' | null>(null);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Settings State
  const [theme, setTheme] = useState<Theme>('light');
  const [accentColorName, setAccentColorName] = useState(ACCENT_COLORS[0].name);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState<FontFamily>('sans');

  const accentColor = ACCENT_COLORS.find(c => c.name === accentColorName)?.[theme === 'light' ? 'light' : 'dark'] || ACCENT_COLORS[0].dark;

  const markdownRef = useRef(markdown);
  const filePathRef = useRef(filePath);
  const isEditing = viewMode === 'editing' || viewMode === 'split';
  const isEditingRef = useRef(isEditing);

  useEffect(() => {
    markdownRef.current = markdown;
    filePathRef.current = filePath;
    isEditingRef.current = isEditing;
  }, [markdown, filePath, isEditing]);

  const handleOpenFile = async (path?: string) => {
    try {
      const selected = path || await open({
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
      });

      if (selected && typeof selected === 'string') {
        const contents = await readTextFile(selected);
        setMarkdown(contents);
        setSavedMarkdown(contents);
        setFilePath(selected);
      }
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  };

  useEffect(() => {
    const unlistenPromise = listen<string>("open-file", (event) => {
      if (event.payload) {
        handleOpenFile(event.payload);
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, []);

  const handleSaveFile = async (forceSaveAs: boolean = false) => {
    try {
      let path = filePathRef.current;
      if (!path || forceSaveAs) {
        path = await save({
          filters: [{ name: 'Markdown', extensions: ['md'] }]
        });
      }
      
      if (path) {
        await writeTextFile(path, markdownRef.current);
        setFilePath(path);
        setSavedMarkdown(markdownRef.current);
      }
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  };

  const insertMarkdown = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = before + prefix + selectedText + suffix + after;
    setMarkdown(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  // Find & Replace Logic
  useEffect(() => {
    if (!findText) {
      setFindResults([]);
      setCurrentResultIndex(-1);
      return;
    }

    try {
      const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? "g" : "gi");
      const results: number[] = [];
      let match;
      while ((match = regex.exec(markdown)) !== null) {
        results.push(match.index);
      }
      setFindResults(results);
      if (results.length > 0) {
        if (currentResultIndex === -1 || currentResultIndex >= results.length) {
          setCurrentResultIndex(0);
        }
      } else {
        setCurrentResultIndex(-1);
      }
    } catch (e) {
      setFindResults([]);
      setCurrentResultIndex(-1);
    }
  }, [findText, matchCase, markdown]);

  const scrollToMatch = (index: number) => {
    if (index < 0 || index >= findResults.length) return;
    
    if (viewMode !== 'reading' && textareaRef.current) {
      const pos = findResults[index];
      const textarea = textareaRef.current;
      textarea.focus();
      textarea.setSelectionRange(pos, pos + findText.length);
      
      const lineHeight = fontSize * 1.5; 
      const linesBefore = markdown.substring(0, pos).split('\n').length;
      textarea.scrollTop = (linesBefore - 5) * lineHeight;
    } else if (viewMode === 'reading') {
      // Use browser built-in search for reading mode rendered content
      (window as any).find(findText, matchCase, false, true, false, true, false);
    }
  };

  const handleNextMatch = () => {
    if (findText && viewMode === 'reading') {
      (window as any).find(findText, matchCase, false, true, false, true, false);
      return;
    }
    
    if (findResults.length === 0) return;
    const nextIndex = (currentResultIndex + 1) % findResults.length;
    setCurrentResultIndex(nextIndex);
    scrollToMatch(nextIndex);
  };

  const handlePrevMatch = () => {
    if (findText && viewMode === 'reading') {
      (window as any).find(findText, matchCase, true, true, false, true, false);
      return;
    }

    if (findResults.length === 0) return;
    const prevIndex = (currentResultIndex - 1 + findResults.length) % findResults.length;
    setCurrentResultIndex(prevIndex);
    scrollToMatch(prevIndex);
  };

  const handleReplace = () => {
    if (currentResultIndex < 0 || !textareaRef.current) return;
    const pos = findResults[currentResultIndex];
    const newMarkdown = markdown.substring(0, pos) + replaceText + markdown.substring(pos + findText.length);
    setMarkdown(newMarkdown);
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? "g" : "gi");
    setMarkdown(markdown.replace(regex, replaceText));
  };

  // Direct Sync Logic
  const handleScroll = (side: 'editor' | 'preview') => (e: React.UIEvent<HTMLElement>) => {
    if (!isSyncScroll || viewMode !== 'split') return;
    if (activeSide.current !== side) return;

    const source = e.currentTarget;
    const target = side === 'editor' ? previewRef.current : textareaRef.current;

    if (target) {
      const sourceMaxScroll = source.scrollHeight - source.clientHeight;
      const targetMaxScroll = target.scrollHeight - target.clientHeight;
      if (sourceMaxScroll <= 0) return;
      const percentage = source.scrollTop / sourceMaxScroll;
      target.scrollTop = percentage * targetMaxScroll;
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Global shortcuts: available in all modes
      if (isMod) {
        if (e.key === 'Enter') {
          e.preventDefault();
          setViewMode(prev => prev === 'reading' ? 'editing' : 'reading');
          return;
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleSaveFile();
          return;
        } else if (e.key.toLowerCase() === 'o') {
          e.preventDefault();
          handleOpenFile();
          return;
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          setMarkdown(""); 
          setSavedMarkdown(""); 
          setFilePath(null); 
          setViewMode('editing');
          return;
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          setIsFindVisible(true);
          setTimeout(() => findInputRef.current?.focus(), 10);
          return;
        }
      }
      
      if (e.key === 'Escape') {
        if (isFindVisible) {
          setIsFindVisible(false);
          e.preventDefault();
        }
        return;
      }

      // Editor-only shortcuts
      if (!isEditingRef.current) {
        return;
      }

      const textarea = textareaRef.current;
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      if (e.key === 'Tab') {
        e.preventDefault();

        // Find the start of the current line
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = text.indexOf('\n', start);
        const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);

        if (e.shiftKey) {
          // Outdent
          if (currentLine.startsWith("  ")) {
            const newText = text.substring(0, lineStart) + currentLine.substring(2) + text.substring(lineEnd === -1 ? text.length : lineEnd);
            setMarkdown(newText);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
            }, 0);
          }
        } else {
          // Indent
          const newText = text.substring(0, lineStart) + "  " + currentLine + text.substring(lineEnd === -1 ? text.length : lineEnd);
          setMarkdown(newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 2;
          }, 0);
        }
        return;
      }

      if (isMod) {
        if (e.key.toLowerCase() === 'b') {
          e.preventDefault();
          insertMarkdown("**", "**");
        } else if (e.key.toLowerCase() === 'i') {
          e.preventDefault();
          insertMarkdown("_", "_");
        }
      } else if (e.key === 'Enter') {
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        const line = text.substring(lineStart, start);
        const bulletMatch = line.match(/^(\s*[-*+] )/);
        const numberedMatch = line.match(/^(\s*\d+\. )/);
        
        if (bulletMatch) {
          e.preventDefault();
          const newMarkdown = text.substring(0, start) + '\n' + bulletMatch[1] + text.substring(end);
          setMarkdown(newMarkdown);
          setTimeout(() => {
            textarea.selectionStart = start + bulletMatch[1].length + 1;
            textarea.selectionEnd = start + bulletMatch[1].length + 1;
          }, 0);
        } else if (numberedMatch) {
          e.preventDefault();
          const indent = numberedMatch[1].match(/^\s*/)?.[0] || '';
          const oldNumber = parseInt(numberedMatch[1].match(/\d+/)?.[0] || '0');
          const newNumber = oldNumber + 1;
          const newMarker = `${indent}${newNumber}. `;
          const newMarkdown = text.substring(0, start) + '\n' + newMarker + text.substring(end);
          setMarkdown(newMarkdown);
          setTimeout(() => {
            textarea.selectionStart = start + newMarker.length + 1;
            textarea.selectionEnd = start + newMarker.length + 1;
          }, 0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFindVisible]);

  const handleEditorChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdown(e.target.value);
  };

  const isDirty = markdown !== savedMarkdown;
  const fileName = filePath ? (filePath.includes('\\') ? filePath.split('\\').pop() : filePath.split('/').pop()) : "Untitled.md";
  const displayFileName = `${fileName}${isDirty ? ' *' : ''}`;

  // Theme Config
  const getThemeClasses = () => {
    if (theme === 'dark') return 'dark bg-[#1e1e2e] text-[#cdd6f4]';
    if (theme === 'dim') return 'dark bg-[#3a3a3a] text-[#f2f2f2]';
    return 'bg-[#eff1f5] text-[#4c4f69]';
  };

  const getSecondaryThemeClasses = () => {
    if (theme === 'dark') return 'bg-[#181825] border-[#313244]';
    if (theme === 'dim') return 'bg-[#4a4a4a] border-[#5a5a5a]';
    return 'bg-[#eff1f5] border-[#dce0e8]';
  };

  const getFooterThemeClasses = () => {
    if (theme === 'dark') return 'bg-[#11111b] border-[#313244] text-[#bac2de]';
    if (theme === 'dim') return 'bg-[#2a2a2a] border-[#4a4a4a] text-[#cccccc]';
    return 'bg-[#dce0e8] border-[#bac2de] text-[#6c6f85]';
  };

  const appStyles = {
    '--accent-color': accentColor,
    '--font-size': `${fontSize}px`,
  } as React.CSSProperties;

  const getFontClass = () => {
    if (fontFamily === 'serif') return 'font-serif';
    if (fontFamily === 'mono') return 'font-mono';
    return 'font-sans';
  };

  const headers = markdown.split('\n')
    .filter(line => line.startsWith('#'))
    .map(line => {
      const level = line.match(/^#+/)?.[0].length || 1;
      const text = line.replace(/^#+\s*/, '');
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      return { level, text, id };
    });

  const resolveLocalPath = (href: string) => {
    if (href.startsWith('/') || href.includes('://') || (href.includes(':') && href.includes('\\'))) return href;
    if (!filePath) return href; 
    const separator = filePath.includes('\\') ? '\\' : '/';
    const parts = filePath.split(separator);
    parts.pop(); 
    const baseDir = parts.join(separator);
    return `${baseDir}${separator}${href}`;
  };

  // Helper to highlight text in Reading Mode
  const HighlightText = ({ children }: { children: string }) => {
    if (!isFindVisible || !findText) return <>{children}</>;
    
    const parts = children.split(new RegExp(`(${findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, matchCase ? 'g' : 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === findText.toLowerCase() 
            ? <mark key={i} className="search-highlight">{part}</mark> 
            : part
        )}
      </>
    );
  };

  return (
    <div 
      className={`flex flex-col h-screen w-screen overflow-hidden transition-colors duration-200 ${getThemeClasses()}`}
      style={appStyles}
    >
      {/* Editor Toolbar - Hidden in Reading Mode */}
      {viewMode !== 'reading' && (
        <div className={`border-b px-4 py-2 flex items-center justify-center gap-1 z-30 transition-colors ${theme === 'dark' ? 'bg-[#181825] border-[#313244]' : (theme === 'dim' ? 'bg-[#2a2a2a] border-[#4a4a4a]' : 'bg-[#e6e9ef] border-[#bac2de]')}`}>
          <button onClick={() => insertMarkdown("**", "**")} title="Bold" className="p-2 hover:bg-slate-500/10 rounded text-slate-500">
            <Bold size={18} />
          </button>
          <button onClick={() => insertMarkdown("_", "_")} title="Italic" className="p-2 hover:bg-slate-500/10 rounded text-slate-500">
            <Italic size={18} />
          </button>
          <div className="w-px h-5 bg-slate-500/10 mx-1"></div>
          <button onClick={() => insertMarkdown("# ")} className="p-2 hover:bg-slate-500/10 rounded text-slate-500 font-bold text-xs uppercase">H1</button>
          <button onClick={() => insertMarkdown("## ")} className="p-2 hover:bg-slate-500/10 rounded text-slate-500 font-bold text-xs uppercase">H2</button>
          <button onClick={() => insertMarkdown("### ")} className="p-2 hover:bg-slate-500/10 rounded text-slate-500 font-bold text-xs uppercase">H3</button>
          <div className="w-px h-5 bg-slate-500/10 mx-1"></div>
          <button onClick={() => insertMarkdown("- ")} title="Bullet List" className="p-2 hover:bg-slate-500/10 rounded text-slate-500">
            <List size={18} />
          </button>
          <button onClick={() => insertMarkdown("```\n", "\n```")} title="Code" className="p-2 hover:bg-slate-500/10 rounded text-slate-500">
            <Code size={18} />
          </button>
          <button onClick={() => insertMarkdown("[", "](url)")} title="Link" className="p-2 hover:bg-slate-500/10 rounded text-slate-500">
            <Link size={18} />
          </button>
          <button onClick={() => insertMarkdown("![", "](url)")} title="Image" className="p-2 hover:bg-slate-500/10 rounded text-slate-500">
            <FileImage size={18} />
          </button>
          <button onClick={() => insertMarkdown("| Title | Description |\n| :--- | :--- |\n| Content | Content |")} title="Table" className="p-2 hover:bg-slate-500/10 rounded text-slate-500">
            <Table size={18} />
          </button>
          <button onClick={() => insertMarkdown("  ")} title="Indent" className="p-2 hover:bg-slate-500/10 rounded text-slate-500">
            <Indent size={18} />
          </button>
          <div className="w-px h-5 bg-slate-500/10 mx-1"></div>
          <div className={`flex p-1 rounded-lg ${theme === 'light' ? 'bg-[#dce0e8]' : 'bg-[#313244]'}`}>
            <button onClick={() => setViewMode('editing')} className={`px-2 py-1 rounded transition-all ${viewMode === 'editing' ? (theme === 'light' ? 'bg-white shadow-sm' : 'bg-[#45475a] text-white') : 'text-slate-400 hover:text-slate-600'}`}>
              <PenLine size={14} />
            </button>
            <button onClick={() => setViewMode('split')} className={`px-2 py-1 rounded transition-all ${viewMode === 'split' ? (theme === 'light' ? 'bg-white shadow-sm' : 'bg-[#45475a] text-white') : 'text-slate-400 hover:text-slate-600'}`}>
              <Columns2 size={14} />
            </button>
            <button onClick={() => setIsSyncScroll(!isSyncScroll)} className={`px-2 py-1 rounded transition-all ${isSyncScroll && viewMode === 'split' ? (theme === 'light' ? 'bg-white shadow-sm text-[var(--accent-color)]' : 'bg-[#45475a] text-white') : 'text-slate-400 hover:text-slate-600'}`}>
              <Link2 size={14} />
            </button>
            <button onClick={() => setViewMode('reading')} className={`px-2 py-1 rounded transition-all ${(viewMode as string) === 'reading' ? (theme === 'light' ? 'bg-white shadow-sm' : 'bg-[#45475a] text-white') : 'text-slate-400 hover:text-slate-600'}`}>
              <Eye size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Find & Replace Bar */}
      {isFindVisible && (
        <div className={`border-b px-4 py-2 flex flex-wrap items-center justify-center gap-3 z-20 transition-colors animate-in slide-in-from-top-2 duration-200 ${theme === 'dark' ? 'bg-[#1e1e2e] border-[#313244]' : (theme === 'dim' ? 'bg-[#3a3a3a] border-[#4a4a4a]' : 'bg-[#eff1f5] border-[#dce0e8]')}`}>
          <div className="flex items-center gap-2">
            <div className={`relative flex items-center rounded-md border ${theme === 'light' ? 'bg-white border-[#dce0e8]' : 'bg-[#11111b] border-[#313244]'}`}>
              <input
                ref={findInputRef}
                type="text"
                placeholder="Find"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNextMatch(); }}
                className="bg-transparent px-3 py-1 text-xs outline-none w-48"
              />
              <div className="flex items-center px-2 border-l border-slate-500/10 gap-1">
                <span className="text-[10px] font-mono opacity-40">
                  {findResults.length > 0 ? `${currentResultIndex + 1}/${findResults.length}` : '0/0'}
                </span>
                <button onClick={handlePrevMatch} className="p-1 hover:bg-slate-500/10 rounded opacity-60"><ChevronUp size={12} /></button>
                <button onClick={handleNextMatch} className="p-1 hover:bg-slate-500/10 rounded opacity-60"><ChevronDown size={12} /></button>
              </div>
            </div>
            <button 
              onClick={() => setMatchCase(!matchCase)} 
              className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${matchCase ? 'border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--accent-color)]/10' : 'border-slate-500/20 opacity-40'}`}
            >
              Ab
            </button>
          </div>

          {viewMode !== 'reading' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
              <input
                type="text"
                placeholder="Replace"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className={`px-3 py-1 text-xs outline-none w-48 rounded-md border ${theme === 'light' ? 'bg-white border-[#dce0e8]' : 'bg-[#11111b] border-[#313244]'}`}
              />
              <div className="flex gap-1">
                <button onClick={handleReplace} className="px-3 py-1 bg-slate-500/10 hover:bg-slate-500/20 rounded text-[10px] font-bold uppercase tracking-wider">Replace</button>
                <button onClick={handleReplaceAll} className="px-3 py-1 bg-slate-500/10 hover:bg-slate-500/20 rounded text-[10px] font-bold uppercase tracking-wider">All</button>
              </div>
            </div>
          )}

          <button onClick={() => setIsFindVisible(false)} className="p-1 hover:text-red-500 opacity-40"><X size={16} /></button>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden relative min-h-0">
        {(viewMode === 'editing' || viewMode === 'split') && (
          <div 
            className={`${viewMode === 'split' ? 'w-1/2 border-r border-slate-500/10' : 'w-full'} h-full overflow-hidden`}
            onMouseEnter={() => activeSide.current = 'editor'}
          >
            <textarea
              ref={textareaRef}
              onScroll={handleScroll('editor')}
              className="w-full h-full p-10 pb-[30vh] mx-auto resize-none outline-none bg-transparent font-sans leading-relaxed selection:bg-[var(--accent-color)] selection:text-white max-w-[720px] block overflow-y-auto"
              style={{ fontSize: `${fontSize}px`, scrollBehavior: 'auto' }}
              value={markdown}
              onChange={handleEditorChange}
              placeholder="Start writing..."
              spellCheck={false}
              autoFocus
            />
          </div>
        )}

        {(viewMode === 'reading' || viewMode === 'split') && (
          <div 
            ref={previewRef} 
            onScroll={handleScroll('preview')} 
            onMouseEnter={() => activeSide.current = 'preview'}
            className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} h-full overflow-y-auto`}
            style={{ scrollBehavior: 'auto' }}
          >
            <div className="flex justify-center min-h-full">
              <div className={`w-full max-w-[720px] p-10 pb-[30vh] markdown-body ${getFontClass()}`} style={{ fontSize: `${fontSize}px` }}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Use standard elements but highlight their text content
                    p: ({node, ...props}) => <p {...props} />,
                    h1: ({node, ...props}) => <h1 id={props.children?.toString().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')} {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl" id={props.children?.toString().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')} {...props} />,
                    h3: ({node, ...props}) => <h3 id={props.children?.toString().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')} {...props} />,
                    // Handle plain text nodes for highlighting
                    text: ({node, ...props}) => <HighlightText>{props.children as string}</HighlightText>,
                    a: ({ node, ...props }) => {
                      const href = props.href || "";
                      const isExternal = href.startsWith("http") || href.startsWith("https");
                      const isAnchor = href.startsWith("#");
                      const isMd = href.toLowerCase().endsWith(".md");
                      const isImageFile = IMAGE_EXTENSIONS.some(ext => href.toLowerCase().endsWith(ext));

                      if (isImageFile) {
                        const fullPath = resolveLocalPath(href);
                        const finalSrc = isExternal ? href : (fullPath ? convertFileSrc(fullPath) : "");
                        return (
                          <span className="block my-6 mx-auto text-center bg-slate-500/5 rounded-lg p-2 group">
                            <img 
                              src={finalSrc} 
                              alt={props.children?.toString() || "Markdown Image"}
                              className="max-w-full rounded-lg shadow-lg inline-block transition-transform hover:scale-[1.02]"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.opacity = '0.3';
                              }}
                            />
                            <br />
                            <small className="opacity-40 italic mt-2 inline-block group-hover:opacity-60 transition-opacity">{props.children}</small>
                          </span>
                        );
                      }

                      const handleClick = async (e: React.MouseEvent) => {
                        e.preventDefault();
                        if (isExternal) {
                          await openUrl(href);
                        } else if (isAnchor) {
                          const id = href.substring(1);
                          const element = document.getElementById(id);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth' });
                          }
                        } else if (isMd) {
                          const normalizedHref = href.startsWith('/') ? href.substring(1) : href;
                          if (normalizedHref === 'MarkdownGuide.md') {
                            setMarkdown(markdownGuide);
                            setSavedMarkdown(markdownGuide);
                            setFilePath(null);
                            setViewMode('reading');
                            return;
                          }
                          if (normalizedHref === 'Opening.md') {
                            setMarkdown(openingMd);
                            setSavedMarkdown(openingMd);
                            setFilePath(null);
                            setViewMode('reading');
                            return;
                          }

                          const fullPath = resolveLocalPath(href);
                          if (fullPath) {
                            handleOpenFile(fullPath);
                          } else {
                            handleOpenFile();
                          }
                        }
                      };

                      return (
                        <a 
                          {...props} 
                          onClick={handleClick}
                          className="text-[var(--accent-color)] hover:underline cursor-pointer"
                        />
                      );
                    },
                    img: ({ node, ...props }) => {
                      const src = props.src || "";
                      const isExternal = src.startsWith("http") || src.startsWith("https");
                      const fullPath = resolveLocalPath(src);
                      const finalSrc = isExternal ? src : (fullPath ? convertFileSrc(fullPath) : "");
                      
                      return (
                        <img 
                          {...props} 
                          src={finalSrc} 
                          className="max-w-full rounded-lg shadow-lg my-6 mx-auto block transition-transform hover:scale-[1.01]"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.opacity = '0.3';
                          }}
                        />
                      );
                    }
                  }}
                >
                  {markdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* TOC Sidebar */}
        <div className={`fixed right-0 top-0 bottom-0 w-64 p-8 pt-20 border-l z-40 transition-all duration-300 transform shadow-2xl overflow-y-auto ${theme === 'dark' ? 'bg-[#181825]/95 border-[#313244] text-[#cdd6f4]' : (theme === 'dim' ? 'bg-[#3a3a3a]/95 border-[#5a5a5a] text-[#f2f2f2]' : 'bg-[#eff1f5]/95 border-[#dce0e8] text-[#4c4f69]')} ${isTOCVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0 pointer-events-none'}`}>
          <div className="space-y-1">
            <div className="mb-4 text-[10px] font-bold tracking-widest uppercase opacity-40 border-b border-slate-500/10 pb-2">Table of Contents</div>
            {headers.map((h, i) => (
              <button 
                key={i} 
                onClick={() => {
                  const element = document.getElementById(h.id);
                  if (element) element.scrollIntoView({ behavior: 'smooth' });
                }}
                className="block w-full text-left py-1.5 hover:translate-x-1 transition-all text-[11px] opacity-60 hover:opacity-100 truncate"
                style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
              >
                {h.text}
              </button>
            ))}
            {headers.length === 0 && <div className="text-[10px] opacity-40 italic">No headers found</div>}
          </div>
        </div>

        {isSettingsVisible && (
          <div className={`fixed bottom-12 right-4 w-72 border p-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-xl rounded-xl ${getSecondaryThemeClasses()} ${theme === 'light' ? 'text-[#4c4f69]' : 'text-[#f2f2f2]'}`}>
            <div className="flex items-center justify-between mb-3 border-b border-slate-500/10 pb-2"><h3 className="text-[10px] font-bold tracking-widest uppercase opacity-40">Settings</h3><button onClick={() => setIsSettingsVisible(false)} className="text-[10px] font-bold tracking-widest uppercase hover:text-red-500 transition-colors">Close</button></div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest uppercase opacity-50">Theme</span>
                <button 
                  onClick={() => {
                    const themes: Theme[] = ['light', 'dark', 'dim'];
                    const nextIndex = (themes.indexOf(theme) + 1) % themes.length;
                    setTheme(themes[nextIndex]);
                  }} 
                  className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded transition-all active:scale-95 border border-transparent ${
                    theme === 'light' ? 'bg-[#dce0e8] text-[var(--accent-color)]' : 
                    theme === 'dark' ? 'bg-[#313244] text-[var(--accent-color)]' : 
                    'bg-[#5a5a5a] text-[var(--accent-color)]'
                  }`}
                >
                  {theme} mode
                </button>
              </div>
              <div className="flex items-center justify-between"><span className="text-[10px] font-bold tracking-widest uppercase opacity-50">Accent</span><div className="flex gap-1.5">{ACCENT_COLORS.map(c => <button key={c.name} onClick={() => setAccentColorName(c.name)} className={`w-3.5 h-3.5 rounded-full transition-transform active:scale-90 ${accentColorName === c.name ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-40'}`} style={{ backgroundColor: theme === 'light' ? c.light : c.dark }} />)}</div></div>
              <div className="flex items-center justify-between"><span className="text-[10px] font-bold tracking-widest uppercase opacity-50">Font Size</span><div className="flex items-center gap-2"><button onClick={() => setFontSize(Math.max(12, fontSize - 1))} className="p-1 rounded transition-all hover:bg-slate-500/10"><Minus size={14} /></button><span className="text-[10px] font-bold opacity-40 w-8 text-center">{fontSize}px</span><button onClick={() => setFontSize(Math.min(24, fontSize + 1))} className="p-1 rounded transition-all hover:bg-slate-500/10"><Plus size={14} /></button></div></div>
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-500/10"><span className="text-[10px] font-bold tracking-widest uppercase opacity-50 mb-1">Font Family</span><div className="flex gap-1.5">{(['sans', 'serif', 'mono'] as FontFamily[]).map(f => <button key={f} onClick={() => setFontFamily(f)} className={`flex-1 text-[9px] font-bold tracking-widest uppercase py-1.5 rounded transition-all border ${fontFamily === f ? `bg-white/10 border-transparent text-[var(--accent-color)]` : `border-slate-500/10 opacity-40 hover:opacity-100`}`}>{f}</button>)}</div></div>
            </div>
          </div>
        )}
      </main>

            <footer className={`border-t px-4 py-1 flex items-center justify-between z-50 transition-colors ${getFooterThemeClasses()}`}>
              {/* Reading and Editing indicators are always on the left */}
              <div className="flex-1 flex items-center gap-3 text-[9px] font-bold tracking-widest uppercase">
                <span style={{ color: accentColor }} className={`transition-opacity cursor-default ${viewMode === 'reading' ? 'opacity-50' : 'opacity-100'}`}>{viewMode.toUpperCase()}</span>
                <button onClick={() => handleOpenFile()} className={`text-[var(--accent-color)] hover:opacity-100 transition-opacity uppercase ${viewMode === 'reading' ? 'opacity-50' : 'opacity-100'}`}>OPEN</button>
                <button onClick={() => { setMarkdown(""); setSavedMarkdown(""); setFilePath(null); setViewMode('editing'); }} className={`text-[var(--accent-color)] hover:opacity-100 transition-opacity uppercase ${viewMode === 'reading' ? 'opacity-50' : 'opacity-100'}`}>NEW</button>
                <button onClick={() => { setIsFindVisible(!isFindVisible); if (!isFindVisible) setTimeout(() => findInputRef.current?.focus(), 10); }} className={`transition-all uppercase text-[var(--accent-color)] ${isFindVisible ? 'opacity-100' : (viewMode === 'reading' ? 'opacity-50 hover:opacity-100' : 'opacity-100')}`}>FIND</button>
              </div>
      
              {/* FileName in the center */}
              <div className="flex-1 flex justify-center overflow-hidden">
                <span className="text-[9px] font-bold opacity-60 truncate px-4">- {displayFileName} -</span>
              </div>
      
              {/* Right actions based on mode */}
              <div className="flex-1 flex items-center justify-end gap-3 text-[9px] font-bold tracking-widest uppercase">
                <button onClick={() => setIsTOCVisible(!isTOCVisible)} className={`transition-all uppercase text-[var(--accent-color)] ${isTOCVisible ? 'opacity-100' : (viewMode === 'reading' ? 'opacity-50 hover:opacity-100' : 'opacity-100')}`}>TOC</button>
                <button onClick={() => setIsSettingsVisible(!isSettingsVisible)} className={`transition-all uppercase text-[var(--accent-color)] ${isSettingsVisible ? 'opacity-100' : (viewMode === 'reading' ? 'opacity-50 hover:opacity-100' : 'opacity-100')}`}>SETTINGS</button>
                

                  {viewMode === 'reading' ? (
                    <button onClick={() => setViewMode('editing')} className="text-[var(--accent-color)] opacity-50 hover:opacity-100 transition-all uppercase whitespace-nowrap">EDIT</button>
                  ) : (
                    <>
                      <button onClick={() => handleSaveFile(false)} className="text-[var(--accent-color)] opacity-100 hover:opacity-100 transition-all uppercase whitespace-nowrap">SAVE</button>
                      <button onClick={() => handleSaveFile(true)} className="text-[var(--accent-color)] opacity-100 hover:opacity-100 transition-all uppercase whitespace-nowrap">SAVE AS</button>
                      <button onClick={() => { setMarkdown(savedMarkdown); setViewMode('reading'); }} className="opacity-100 hover:text-red-500 hover:opacity-100 transition-all uppercase whitespace-nowrap">DON'T SAVE</button>
                    </>
                  )}

              </div>
            </footer>
    </div>
  );
}

export default App;
