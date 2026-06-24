import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppletData } from "./DataContext";
import { Folder, Upload, Trash2, Edit2, Plus, Save, LogOut, Link2, FileVideo, Check, RefreshCw, Share, User, Settings, LayoutList, ChevronDown, ChevronUp, Download } from "lucide-react";
import { Project, GalleryImage, AboutInfo } from "./types";
import { getApiUrl, getImageUrl } from "./api";
import { ProgressiveImage } from "./components/ProgressiveImage";
import { ProcessEditorModal } from "./components/ProcessEditorModal";
import { Reorder } from "motion/react";

// Safe localStorage wrappers to prevent iframe cross-origin DOMException
const safeGetItem = (key: string) => {
  try { return localStorage.getItem(key); } catch (e) { return null; }
};
const safeSetItem = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch (e) {}
};
const safeRemoveItem = (key: string) => {
  try { localStorage.removeItem(key); } catch (e) {}
};

export function AdminPanel() {
  const [token, setToken] = useState(safeGetItem("adminToken") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const { projects, about, sidebar, refreshData } = useAppletData();
  const [localProjects, setLocalProjects] = useState<Project[]>(projects);
  const [localAbout, setLocalAbout] = useState<AboutInfo>(about);
  const [localSidebar, setLocalSidebar] = useState<any[]>(sidebar || []);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<"folders" | "about" | "settings" | "sidebar">("folders");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dragActiveProjectId, setDragActiveProjectId] = useState<string | null>(null);
  const [processEditorOpen, setProcessEditorOpen] = useState<{ projectId: string; imageIndex: number } | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    try {
      const stored = safeGetItem("admin-expanded-folders");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse expanded folders", e);
    }
    return {};
  });

  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [uploadingGifs, setUploadingGifs] = useState(false);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch(getApiUrl("/api/backups"), {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBackupsList(data.backups || []);
      }
    } catch (err) {
      console.error("Failed to fetch backups:", err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (token && activeTab === "settings") {
      fetchBackups();
    }
  }, [token, activeTab]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = { ...prev, [folderId]: !prev[folderId] };
      safeSetItem("admin-expanded-folders", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (!isInitialized && projects.length > 0) {
      setLocalProjects(JSON.parse(JSON.stringify(projects)));
      setIsInitialized(true);
    }
  }, [projects, isInitialized]);

  useEffect(() => {
    if (!isInitialized && about) {
      setLocalAbout(JSON.parse(JSON.stringify(about)));
    }
  }, [about, isInitialized]);

  useEffect(() => {
    if (!isInitialized && sidebar && sidebar.length > 0) {
      setLocalSidebar(JSON.parse(JSON.stringify(sidebar)));
    }
  }, [sidebar, isInitialized]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Attempting login at URL: ", getApiUrl("/api/login"));
    console.log("Payload:", { username, password });
    try {
      const res = await fetch(getApiUrl("/api/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      console.log("Login response status: ", res.status);
      const data = await res.json();
      console.log("Login response data: ", data);
      
      if (data.success) {
        safeSetItem("adminToken", data.token);
        setToken(data.token);
        navigate("/admin");
      } else {
        setError("Invalid credentials");
      }
    } catch (err: any) {
      console.error("Login exception: ", err);
      setError(`Login failed: ${err.message || String(err)}`);
    }
  };

  const handleLogout = () => {
    safeRemoveItem("adminToken");
    setToken("");
    navigate("/");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentRemoteDataRes = await fetch(getApiUrl("/api/data"), { cache: "no-store" });
      const currentRemoteData = await currentRemoteDataRes.json();
      
      const payloadObj = { 
        PROJECTS: localProjects, 
        EXTERNAL_LINKS: currentRemoteData.EXTERNAL_LINKS,
        ABOUT: localAbout,
        SIDEBAR: localSidebar
      };
      
      const payloadStr = JSON.stringify(payloadObj);
      const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB chunk size
      
      if (payloadStr.length > CHUNK_SIZE) {
        console.log(`Payload is large (${(payloadStr.length / 1024 / 1024).toFixed(2)}MB). Chunking...`);
        const totalChunks = Math.ceil(payloadStr.length / CHUNK_SIZE);
        const fileId = `data_${Date.now()}`;
        
        let lastRes;
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const chunkStr = payloadStr.slice(start, start + CHUNK_SIZE);
          
          const res = await fetch(getApiUrl("/api/data"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              fileId,
              chunkIndex: i,
              totalChunks,
              chunkData: chunkStr
            })
          });
          lastRes = await res.json();
          if (!lastRes.success) {
            throw new Error(lastRes.error || "Chunk upload failed");
          }
        }
      } else {
        console.log("Saving normally to:", getApiUrl("/api/data"));
        const res = await fetch(getApiUrl("/api/data"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: payloadStr
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error("Save error response:", errText);
          throw new Error(errText);
        }
      }

      await refreshData();
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error("Save Exception:", err);
      alert(`Error saving data: ${err.message || String(err)}`);
    }
    setSaving(false);
  };

  const addFolder = () => {
    const newId = `project-${Date.now()}`;
    setLocalProjects([...localProjects, {
      id: newId,
      name: "New Folder",
      category: "Category",
      badge: "Badge",
      description: "Description",
      longDescription: "Long Description",
      client: "Client",
      year: "2024",
      tags: [],
      imageUrl: "",
      features: [],
      gallery: [],
      wordpressCode: { customPostType: "", acfFields: "", phpQuery: "", instructions: "" }
    }]);
  };

  const deleteFolder = (id: string) => {
    setLocalProjects(localProjects.filter(p => p.id !== id));
  };

  const updateFolder = (id: string, updates: Partial<Project>) => {
    setLocalProjects(localProjects.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const addYouTubeLink = (projectId: string) => {
    setLocalProjects(localProjects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          gallery: [...p.gallery, { url: "https://img.youtube.com/vi/gB9mSyxdhyQ/maxresdefault.jpg", caption: "New Video", isVideo: true, videoUrl: "https://www.youtube.com/watch?v=gB9mSyxdhyQ" }]
        };
      }
      return p;
    }));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const uploadFileWithChunks = async (file: File): Promise<string> => {
    const base64Content = await fileToBase64(file);
    // 3MB chunk sizes for the base64 string
    const CHUNK_SIZE = 3 * 1024 * 1024;
    const totalChunks = Math.ceil(base64Content.length / CHUNK_SIZE);
    const fileId = `${file.name}_${Date.now()}`;
    
    let lastData = null;
    for (let i = 0; i < totalChunks; i++) {
       const start = i * CHUNK_SIZE;
       const chunkStr = base64Content.slice(start, start + CHUNK_SIZE);
       
       const res = await fetch(getApiUrl("/api/upload"), {
         method: "POST",
         headers: { 
           "Authorization": `Bearer ${token}`,
           "Content-Type": "application/json"
         },
         body: JSON.stringify({
           fileId,
           chunkIndex: i,
           totalChunks,
           fileName: file.name,
           mimeType: file.type,
           fileBase64: chunkStr
         })
       });

       try {
         lastData = await res.json();
       } catch (err) {
         throw new Error(`Server returned a non-JSON response (Status ${res.status}). Upload failed.`);
       }

       if (!lastData?.success) {
         throw new Error(lastData?.error || "Upload failed during chunk transfer.");
       }
    }
    
    return lastData!.url;
  };

  const handleFolderIconUpload = async (projectId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadFileWithChunks(file);
      updateFolder(projectId, { folderIconImage: url });
    } catch (err: any) {
      console.error("Upload error", err);
      alert("Upload error: " + (err.message || String(err)));
    }
    e.target.value = "";
  };

  const processFilesForGallery = async (projectId: string, files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    try {
      const newGalleryItems: { url: string, caption: string, fileName?: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          const url = await uploadFileWithChunks(file);
          newGalleryItems.push({ url, caption: "New Image", fileName: file.name });
        } catch (err: any) {
          alert(`Upload failed for ${file.name}: ${err.message || String(err)}`);
        }
      }
      
      if (newGalleryItems.length > 0) {
        setLocalProjects(localProjects => localProjects.map(p => {
          if (p.id === projectId) {
            return {
              ...p,
              gallery: [...p.gallery, ...newGalleryItems]
            };
          }
          return p;
        }));
      }
    } catch (err: any) {
      console.error("Upload error", err);
      alert("Upload error: " + (err.message || String(err)));
    }
  };

  const handleFileUpload = async (projectId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFilesForGallery(projectId, e.target.files);
    }
    e.target.value = "";
  };

  const downloadUrls = () => {
    const urls: string[] = [];
    localProjects.forEach(proj => {
      proj.gallery.forEach(img => {
        if (img.isVideo && img.videoUrl) {
          urls.push(img.videoUrl);
        }
      });
    });
    
    if (urls.length === 0) {
      alert("No YouTube URLs found in your projects.");
      return;
    }
    
    const blob = new Blob([urls.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'urls.txt';
    a.click();
  };

  const downloadScript = () => {
    const scriptContent = `import sys\nimport subprocess\nimport os\nimport re\nimport json\n\ndef extract_video_id(url):\n    match = re.search(r"(?:v=|\\\\/)([0-9A-Za-z_-]{11}).*", url)\n    return match.group(1) if match else None\n\ndef process_videos(file_path):\n    with open(file_path, 'r') as f:\n        urls = [line.strip() for line in f if line.strip()]\n        \n    os.makedirs('gifs', exist_ok=True)\n    \n    for url in urls:\n        video_id = extract_video_id(url)\n        if not video_id:\n            print(f"Could not extract video ID from {url}")\n            continue\n            \n        try:\n            info_cmd = ["yt-dlp", "--dump-json", url]\n            result = subprocess.run(info_cmd, capture_output=True, text=True, check=True)\n            info = json.loads(result.stdout)\n            title = info.get('title', video_id)\n            safe_title = re.sub(r'[^a-zA-Z0-9]', '_', title)\n        except Exception as e:\n            print(f"Could not fetch title for {url}: {e}")\n            safe_title = video_id\n            \n        gif_path = f"gifs/{video_id}___{safe_title}.gif"\n        if os.path.exists(gif_path):\n            print(f"Skipping {gif_path}, already exists.")\n            continue\n            \n        print(f"Processing {url} -> {gif_path}")\n        \n        temp_video = f"temp_{video_id}.mp4"\n        cmd_download = [\n            "yt-dlp",\n            "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4",\n            "--download-sections", "*0-10",\n            "-o", temp_video,\n            url\n        ]\n        \n        try:\n            subprocess.run(cmd_download, check=True)\n            \n            cmd_gif = [\n                "ffmpeg",\n                "-y",\n                "-i", temp_video,\n                "-vf", "fps=30,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",\n                "-loop", "0",\n                gif_path\n            ]\n            subprocess.run(cmd_gif, check=True)\n            \n            os.remove(temp_video)\n            print(f"Successfully created {gif_path}")\n            \n        except subprocess.CalledProcessError as e:\n            print(f"Error processing {url}: {e}")\n            if os.path.exists(temp_video):\n                os.remove(temp_video)\n\nif __name__ == "__main__":\n    process_videos("urls.txt")\n`;
    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'make_gifs.py';
    a.click();
  };

  const handleGifUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingGifs(true);
    try {
      let uploadedCount = 0;
      const newProjects = JSON.parse(JSON.stringify(localProjects));
      
      for (const file of files) {
        const fileNameMatch = file.name.match(/^([0-9A-Za-z_-]{11})(?:___(.*))?\.gif$/);
        if (!fileNameMatch) continue;
        const ytId = fileNameMatch[1];
        const titlePart = fileNameMatch[2];
        const formattedTitle = titlePart ? titlePart.replace(/_+/g, '_') + '.mp4' : undefined;
        
        const url = await uploadFileWithChunks(file);
        
        newProjects.forEach((proj: any) => {
          proj.gallery.forEach((img: any) => {
            if (img.isVideo && img.videoUrl) {
              let currentYtId = null;
              try {
                const urlObj = new URL(img.videoUrl);
                if (urlObj.hostname.includes("youtube.com")) {
                  currentYtId = urlObj.searchParams.get("v") || "";
                } else if (urlObj.hostname.includes("youtu.be")) {
                  currentYtId = urlObj.pathname.slice(1);
                }
              } catch(e) {}
              
              if (currentYtId === ytId) {
                img.url = url;
                if (formattedTitle) {
                  img.fileName = formattedTitle;
                }
                uploadedCount++;
              }
            }
          });
        });
      }
      
      setLocalProjects(newProjects);
      alert(`Successfully uploaded and linked ${uploadedCount} GIF thumbnails! Please click "Save Changes" to persist.`);
    } catch (err) {
      alert("Error uploading GIFs: " + String(err));
    } finally {
      setUploadingGifs(false);
      e.target.value = "";
    }
  };

  const updateImageField = (projectId: string, imageIndex: number, field: "caption" | "videoUrl" | "fileName" | "processInfoHtml", value: string) => {
    setLocalProjects(localProjects.map(proj => {
      if (proj.id === projectId) {
        const newGallery = [...proj.gallery];
        const update = { ...newGallery[imageIndex], [field]: value };
        
        // Auto update thumbnail if it's a video url
        if (field === "videoUrl" && value) {
          try {
            const urlObj = new URL(value);
            let videoId = "";
            if (urlObj.hostname.includes("youtube.com")) {
              videoId = urlObj.searchParams.get("v") || "";
            } else if (urlObj.hostname.includes("youtu.be")) {
              videoId = urlObj.pathname.slice(1);
            }
            if (videoId) {
              update.url = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            }
          } catch(e) {}
        }
        
        newGallery[imageIndex] = update;
        return { ...proj, gallery: newGallery };
      }
      return proj;
    }));
  };

  const deleteImage = (projectId: string, imageIndex: number) => {
    setLocalProjects(localProjects.map(proj => {
      if (proj.id === projectId) {
        const newGallery = [...proj.gallery];
        newGallery.splice(imageIndex, 1);
        return { ...proj, gallery: newGallery };
      }
      return proj;
    }));
  };

  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = safeGetItem("portfolio-theme");
      if (stored === "dark") return true;
      if (stored === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = safeGetItem("portfolio-theme");
      if (stored === "dark") setIsDarkTheme(true);
      else if (stored === "light") setIsDarkTheme(false);
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  if (!token) {
    return (
      <div className={`h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800 overflow-y-auto ${isDarkTheme ? "admin-dark" : ""}`}>
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-sm w-full">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Login</h1>
            <p className="text-sm text-slate-500 mt-2">Sign in to manage your portfolio</p>
            <p className="text-xs text-slate-400 mt-2 break-all bg-slate-50 p-1 rounded font-mono">Backend: {getApiUrl("/api/login")}</p>
          </div>
          
          {error && <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">{error}</div>}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition">
              Sign In
            </button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => navigate("/")} className="text-sm text-slate-500 hover:text-slate-800">Return to Portfolio</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen bg-slate-50 font-sans text-slate-800 flex flex-col overflow-y-auto ${isDarkTheme ? "admin-dark" : ""}`}>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-600 text-white p-2 rounded-md">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Portfolio Admin</h1>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert("Admin Dashboard URL copied to clipboard!");
          }} className="text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-md text-sm font-medium transition flex items-center space-x-2 border border-slate-200 bg-white shadow-sm">
            <Share className="w-4 h-4" />
            <span>Share Dashboard</span>
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className={`${
              saveSuccess 
                ? "bg-green-600 hover:bg-green-700 focus:ring-green-500" 
                : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
            } disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center space-x-2 shadow-sm focus:outline-none focus:ring-2`}
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? "Saving..." : saveSuccess ? "Changes saved" : "Save Changes"}</span>
          </button>
          <button onClick={handleLogout} className="text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-md text-sm font-medium transition flex items-center space-x-2 border border-slate-200 bg-white shadow-sm">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
          <button onClick={() => navigate("/")} className="text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-md text-sm font-medium transition flex items-center space-x-2">
            <span>View Site</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Tab switcher */}
        <div className="flex space-x-1 border border-slate-200 mb-6 bg-slate-100 p-1 rounded-lg max-w-md">
          <button
            onClick={() => setActiveTab("folders")}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs sm:text-sm font-medium transition flex items-center justify-center space-x-2 ${
              activeTab === "folders"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/50"
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>Folders ({localProjects.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs sm:text-sm font-medium transition flex items-center justify-center space-x-2 ${
              activeTab === "about"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/50"
            }`}
          >
            <User className="w-4 h-4" />
            <span>About Me</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs sm:text-sm font-medium transition flex items-center justify-center space-x-2 ${
              activeTab === "settings"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/50"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button
            onClick={() => setActiveTab("sidebar")}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs sm:text-sm font-medium transition flex items-center justify-center space-x-2 ${
              activeTab === "sidebar"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/50"
            }`}
          >
            <LayoutList className="w-4 h-4" />
            <span>Sidebar</span>
          </button>
        </div>

        {activeTab === "folders" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Folders / Projects</h2>
              <button onClick={addFolder} className="bg-white border border-slate-300 hover:border-slate-400 text-slate-700 px-4 py-2 rounded-md text-sm font-medium transition flex items-center space-x-2 shadow-sm">
                <Plus className="w-4 h-4" />
                <span>New Folder</span>
              </button>
            </div>

            <div className="space-y-8 pb-20">
              {localProjects.map((project, folderIndex) => (
            <div key={project.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div 
                className="bg-slate-100 border-b border-slate-200 p-3 sm:px-6 flex justify-between items-center cursor-pointer hover:bg-slate-200 transition"
                onClick={() => toggleFolder(project.id)}
              >
                <div className="flex items-center space-x-3">
                  <Folder className="w-5 h-5 text-slate-500" />
                  <span className="font-semibold text-slate-700">{project.name || "Unnamed Folder"}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-slate-400 text-xs font-medium">{project.gallery?.length || 0} items</span>
                  {expandedFolders[project.id] !== false ? (
                    <ChevronUp className="w-5 h-5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500" />
                  )}
                </div>
              </div>

              {expandedFolders[project.id] !== false && (
                <>
                  <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3 w-full">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Folder Name</label>
                      <input 
                        type="text" 
                        value={project.name} 
                        onChange={e => updateFolder(project.id, { name: e.target.value })} 
                        className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none font-medium"
                      />
                    </div>
                    <div className="w-full sm:w-1/3">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Category</label>
                      <input 
                        type="text" 
                        value={project.category} 
                        onChange={e => updateFolder(project.id, { category: e.target.value })} 
                        className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Folder Description (HTML)</label>
                      <textarea 
                        value={project.description || ""} 
                        onChange={(e) => updateFolder(project.id, { description: e.target.value })} 
                        className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-800"
                        placeholder="<p>Enter description with HTML tags</p>"
                      />
                    </div>
                    <div className="w-full sm:w-1/3">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Custom Folder Icon</label>
                      <div className="flex space-x-2">
                        <input 
                          type="text" 
                          placeholder="URL or Upload ->"
                          value={project.folderIconImage || ""} 
                          onChange={e => updateFolder(project.id, { folderIconImage: e.target.value })} 
                          className="flex-1 w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none min-w-0"
                        />
                        <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-md text-sm font-medium transition flex items-center shrink-0 border border-slate-300">
                          <Upload className="w-4 h-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleFolderIconUpload(project.id, e)} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex sm:flex-col gap-2 shrink-0">
                  <button onClick={() => deleteFolder(project.id)} className="text-red-600 hover:bg-red-50 px-3 py-2 border border-red-200 rounded-md transition text-sm flex items-center justify-center space-x-2 bg-white">
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Folder</span>
                  </button>
                </div>
              </div>

              <div 
                className={`p-4 sm:p-6 transition-colors duration-200 relative ${dragActiveProjectId === project.id ? "bg-slate-100" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragActiveProjectId !== project.id) {
                    setDragActiveProjectId(project.id);
                  }
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  const isOutside = !e.currentTarget.contains(e.relatedTarget as Node);
                  if (isOutside) {
                    setDragActiveProjectId(null);
                  }
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragActiveProjectId(null);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    await processFilesForGallery(project.id, e.dataTransfer.files);
                  }
                }}
              >
                {dragActiveProjectId === project.id && (
                  <div className="absolute inset-0 z-50 border-2 border-dashed border-blue-500 rounded-b-xl flex items-center justify-center bg-blue-50/90 backdrop-blur-sm pointer-events-none">
                    <div className="text-blue-600 font-medium flex items-center space-x-2">
                      <Upload className="w-5 h-5 animate-bounce" />
                      <span>Drop files to add to gallery</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-700">Media Gallery ({project.gallery.length})</h3>
                  <div className="flex space-x-2">
                    <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center space-x-1.5 border border-slate-300">
                      <Upload className="w-4 h-4" />
                      <span>Upload Images</span>
                      <input type="file" multiple accept="image/*,.gif" className="hidden" onChange={e => handleFileUpload(project.id, e)} />
                    </label>
                    <button onClick={() => addYouTubeLink(project.id)} className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center space-x-1.5 border border-red-200">
                      <FileVideo className="w-4 h-4" />
                      <span>Add YouTube</span>
                    </button>
                  </div>
                </div>

                <div className={project.gallery.length > 0 ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" : ""}>
                  {project.gallery.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50">
                      <p className="text-slate-500 text-sm">No media inside this folder. Upload an image or add a YouTube link.</p>
                    </div>
                  ) : (
                    project.gallery.map((img, index) => (
                      <div key={index} className="group relative border border-slate-200 rounded-lg overflow-hidden bg-slate-100 flex flex-col aspect-square">
                        <div className="flex-1 bg-black/5 relative p-2 flex items-center justify-center min-h-0">
                          {img.isVideo ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 rounded text-red-500 overflow-hidden relative">
                              <ProgressiveImage src={getImageUrl(img.url)} containerClassName="absolute inset-0" className="w-full h-full opacity-50" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <FileVideo className="w-8 h-8 opacity-90" />
                              </div>
                            </div>
                          ) : (
                            <ProgressiveImage src={getImageUrl(img.url)} alt="media" objectFit="contain" className="max-w-full max-h-full rounded" containerClassName="w-full h-full flex items-center justify-center" />
                          )}
                          
                          {/* Image Controls overlay */}
                          <div className="absolute top-2 right-2 flex items-center justify-center gap-2 z-10 transition-opacity duration-200">
                            <button onClick={() => setProcessEditorOpen({ projectId: project.id, imageIndex: index })} className={`flex items-center gap-1.5 px-2 py-1.5 bg-white hover:bg-blue-50 ${img.processInfoHtml ? 'text-blue-600 font-medium' : 'text-slate-500 hover:text-blue-600'} rounded border border-slate-200 shadow-sm transition text-[10px] uppercase tracking-wider`} title="Edit Process Details">
                              <Edit2 className="w-3.5 h-3.5" />
                              {img.processInfoHtml ? 'Edit Process' : 'Add Process'}
                            </button>
                            <button onClick={() => deleteImage(project.id, index)} className="p-1.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded border border-slate-200 shadow-sm transition" title="Delete Media">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="p-2 border-t border-slate-200 bg-white space-y-2">
                          <input 
                            type="text" 
                            className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={img.caption}
                            onChange={(e) => updateImageField(project.id, index, "caption", e.target.value)}
                            placeholder="Image caption"
                          />
                          <input 
                            type="text" 
                            className="w-full text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={img.fileName || ""}
                            onChange={(e) => updateImageField(project.id, index, "fileName", e.target.value)}
                            placeholder="Filename (optional)"
                          />
                          {img.isVideo && (
                            <input 
                              type="text" 
                              className="w-full text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              value={img.videoUrl || ""}
                              onChange={(e) => updateImageField(project.id, index, "videoUrl", e.target.value)}
                              placeholder="YouTube URL"
                            />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              </>
            )}
            </div>
          ))}
          
          {localProjects.length === 0 && (
            <div className="text-center py-20 px-6 border-2 border-dashed border-slate-300 rounded-2xl bg-white">
              <Folder className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">No folders exist</h3>
              <p className="text-slate-500 text-sm mb-6">Create a new folder to start building your portfolio.</p>
              <button onClick={addFolder} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition inline-flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Create First Folder</span>
              </button>
            </div>
          )}
        </div>
          </>
        )}

        {activeTab === "about" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6 max-w-4xl">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Edit About Me</h2>
              <p className="text-sm text-slate-500 mt-1">
                Customize the content that appears on your paper sheet in the "About Me.rtf" window.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Name</label>
                <input
                  type="text"
                  value={localAbout?.name || ""}
                  onChange={e => setLocalAbout({ ...localAbout, name: e.target.value })}
                  className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none font-medium"
                  placeholder="e.g. Jake Pay"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Job Title</label>
                <input
                  type="text"
                  value={localAbout?.title || ""}
                  onChange={e => setLocalAbout({ ...localAbout, title: e.target.value })}
                  className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none"
                  placeholder="e.g. Digital & Graphic Designer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Established Year</label>
                <input
                  type="text"
                  value={localAbout?.established || ""}
                  onChange={e => setLocalAbout({ ...localAbout, established: e.target.value })}
                  className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none"
                  placeholder="e.g. 2021"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Location</label>
                <input
                  type="text"
                  value={localAbout?.location || ""}
                  onChange={e => setLocalAbout({ ...localAbout, location: e.target.value })}
                  className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none"
                  placeholder="e.g. London, UK"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Contact Email</label>
                <input
                  type="text"
                  value={localAbout?.contact || ""}
                  onChange={e => setLocalAbout({ ...localAbout, contact: e.target.value })}
                  className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none"
                  placeholder="e.g. hello@designerstudio.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Sign-off Name</label>
                <input
                  type="text"
                  value={localAbout?.signoff || ""}
                  onChange={e => setLocalAbout({ ...localAbout, signoff: e.target.value })}
                  className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none"
                  placeholder="e.g. Jake Pay"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Intro Paragraph</label>
                <textarea
                  value={localAbout?.intro || ""}
                  onChange={e => setLocalAbout({ ...localAbout, intro: e.target.value })}
                  rows={4}
                  className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none resize-none text-sm font-sans"
                  placeholder="Short introductory bio paragraph."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Secondary Paragraph</label>
                <textarea
                  value={localAbout?.bio || ""}
                  onChange={e => setLocalAbout({ ...localAbout, bio: e.target.value })}
                  rows={4}
                  className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none resize-none text-sm font-sans"
                  placeholder="Second bio paragraph highlighting specialties, style etc."
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Application Settings</h2>
              <p className="text-sm text-slate-500 mt-1">
                Configure global settings for the applet.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Browser Tab Icon URL</label>
                <input
                  type="text"
                  value={localAbout?.tabIconUrl || ""}
                  onChange={e => setLocalAbout({ ...localAbout, tabIconUrl: e.target.value })}
                  className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none font-mono text-sm"
                  placeholder="https://example.com/favicon.png"
                />
                <p className="text-xs text-slate-500 mt-1">This icon appears in the browser tab beside the title.</p>
              </div>

              <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <input
                  type="checkbox"
                  id="disableCooldown"
                  checked={localAbout?.disableContactCooldown === true}
                  onChange={e => setLocalAbout({ ...localAbout, disableContactCooldown: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="disableCooldown" className="flex flex-col cursor-pointer">
                  <span className="text-sm font-semibold text-slate-800">Disable Contact Form Cooldown</span>
                  <span className="text-xs text-slate-500">Allows multiple messages to be sent within 10 minutes (useful for testing).</span>
                </label>
              </div>

              <div className="pt-6 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-2">Gif Prep & Auto-Thumbnail</h3>
                <p className="text-xs text-slate-500 mb-4">Export your YouTube links, run a local Python script to generate 10s GIF thumbnails, and upload them here to auto-link them to your videos.</p>
                
                <div className="flex flex-col space-y-4">
                  <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">Step 1: Download Links & Script</h4>
                    <div className="flex space-x-2">
                      <button 
                        onClick={downloadUrls}
                        className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-slate-50 transition shadow-sm"
                      >
                        Download urls.txt
                      </button>
                      <button 
                        onClick={downloadScript}
                        className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-slate-50 transition shadow-sm"
                      >
                        Download make_gifs.py
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                      Requires <code>python</code>, <code>yt-dlp</code>, and <code>ffmpeg</code> installed on your system. Run <code>python make_gifs.py</code> in the same folder as <code>urls.txt</code> to generate the GIFs locally.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">Step 2: Upload Generated GIFs</h4>
                    <label className={`cursor-pointer ${uploadingGifs ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-3 py-1.5 rounded-md text-xs font-medium inline-block transition shadow-sm`}>
                      {uploadingGifs ? "Uploading & Linking..." : "Select GIFs from 'gifs' folder"}
                      <input 
                        type="file" 
                        multiple
                        accept=".gif" 
                        className="hidden" 
                        disabled={uploadingGifs}
                        onChange={handleGifUpload} 
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-2">Data Management</h3>
                <p className="text-xs text-slate-500 mb-4">Restore your portfolio data from a downloaded JSON backup file.</p>
                
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-md text-sm font-medium transition inline-flex items-center space-x-2 border border-slate-300 shadow-sm">
                  <Upload className="w-4 h-4" />
                  <span>Restore from JSON Backup</span>
                  <input 
                    type="file" 
                    accept=".json" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const data = JSON.parse(event.target?.result as string);
                          if (data.PROJECTS) {
                            setLocalProjects((prev: any[]) => {
                              const merged = [...prev];
                              data.PROJECTS.forEach((incomingProj: any) => {
                                const idx = merged.findIndex(p => p.id === incomingProj.id);
                                if (idx !== -1) merged[idx] = { ...merged[idx], ...incomingProj };
                                else merged.push(incomingProj);
                              });
                              return merged;
                            });
                          }
                          if (data.ABOUT) {
                            setLocalAbout((prev: any) => ({ ...prev, ...data.ABOUT }));
                          }
                          if (data.SIDEBAR) {
                            setLocalSidebar((prev: any[]) => {
                              const merged = [...prev];
                              data.SIDEBAR.forEach((incomingLink: any) => {
                                const idx = merged.findIndex(l => l.id === incomingLink.id);
                                if (idx !== -1) merged[idx] = { ...merged[idx], ...incomingLink };
                                else merged.push(incomingLink);
                              });
                              return merged;
                            });
                          }
                          alert("Data imported successfully! Please review the changes and click 'Save Changes' to apply them.");
                        } catch (err) {
                          alert("Failed to parse JSON file.");
                        }
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }} 
                  />
                </label>

                <div className="mt-6">
                  <label className="flex items-center space-x-2">
                    <input 
                      type="checkbox" 
                      checked={localAbout.autoBackupsEnabled !== false}
                      onChange={(e) => setLocalAbout({ ...localAbout, autoBackupsEnabled: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Enable automatic backups (run on save)</span>
                  </label>
                </div>

                <div className="mt-4 max-w-[200px]">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Max Retained Backups</label>
                  <input 
                    type="number" 
                    value={localAbout.maxBackups || 30}
                    onChange={(e) => setLocalAbout({ ...localAbout, maxBackups: parseInt(e.target.value) || 30 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>

                <div className="mt-8 border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-700">Backup History</h4>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch(getApiUrl("/api/backups"), { 
                            method: "POST", 
                            headers: { "Authorization": `Bearer ${token}` } 
                          });
                          if (res.ok) {
                            alert("Backup created successfully!");
                            fetchBackups();
                          }
                        } catch (err) {
                          alert("Failed to create backup.");
                        }
                      }} 
                      className="text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition"
                    >
                      Create Backup Now
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {loadingBackups ? (
                      <div className="p-4 text-center text-sm text-slate-500">Loading backups...</div>
                    ) : backupsList.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">No backups found.</div>
                    ) : (
                      backupsList.map(backup => (
                        <div key={backup.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                          <div>
                            <div className="text-sm font-medium text-slate-800">{new Date(backup.timestamp).toLocaleString()}</div>
                            <div className="text-xs text-slate-500">{backup.id}</div>
                          </div>
                          <div className="flex space-x-2">
                            <button 
                              onClick={async () => {
                                try {
                                  const res = await fetch(getApiUrl(`/api/backups/${backup.id}`), { headers: { "Authorization": `Bearer ${token}` } });
                                  if (res.ok) {
                                    const data = await res.json();
                                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                    const a = document.createElement('a');
                                    a.href = URL.createObjectURL(blob);
                                    a.download = backup.id;
                                    a.click();
                                  }
                                } catch (e) {
                                  alert("Failed to download backup.");
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 transition" title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={async () => {
                                if (confirm("Are you sure you want to restore this backup? This will overwrite your current settings, projects, and about info. You must click 'Save Changes' after restoring to persist them.")) {
                                  try {
                                    const res = await fetch(getApiUrl(`/api/backups/${backup.id}`), { headers: { "Authorization": `Bearer ${token}` } });
                                    if (res.ok) {
                                      const data = await res.json();
                                      if (data.PROJECTS) setLocalProjects(data.PROJECTS);
                                      if (data.ABOUT) setLocalAbout(data.ABOUT);
                                      if (data.SIDEBAR) setLocalSidebar(data.SIDEBAR);
                                      alert("Data restored successfully! Please review the changes and click 'Save Changes' to apply them.");
                                    }
                                  } catch (e) {
                                    alert("Failed to load backup data.");
                                  }
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-green-600 transition" title="Restore"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={async () => {
                                if (confirm("Delete this backup forever?")) {
                                  try {
                                    const res = await fetch(getApiUrl(`/api/backups/${backup.id}`), { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
                                    if (res.ok) fetchBackups();
                                  } catch (e) {
                                    alert("Failed to delete backup.");
                                  }
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-red-600 transition" title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "sidebar" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6 max-w-4xl">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Sidebar Layout</h2>
              <p className="text-sm text-slate-500 mt-1">
                Drag and drop to rearrange your projects, external links, and section titles like an iPhone. Make sure to click Save at the top right when you're done.
              </p>
            </div>
            
            <div className="space-x-2 pb-4">
              <button 
                onClick={() => setLocalSidebar([...localSidebar, { id: "sec-" + Date.now(), type: "title", name: "New Section Title" }])}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-sm font-medium transition"
              >
                + Add Title
              </button>
              <button 
                onClick={() => setLocalSidebar([...localSidebar, { id: "proj-" + Date.now(), type: "project", name: "New Link / Subfolder", targetId: "" }])}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-sm font-medium transition"
              >
                + Add Link / Folder
              </button>
            </div>

            <Reorder.Group axis="y" values={localSidebar} onReorder={setLocalSidebar} className="space-y-2 select-none min-h-[300px]">
              {localSidebar.map((item, idx) => (
                <Reorder.Item key={item.id} value={item} className="bg-white border text-sm border-slate-200 rounded-lg p-3 shadow-sm flex items-center justify-between cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors">
                  <div className="flex items-center space-x-3 w-full">
                    {item.type === "title" ? (
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-xs w-24 shrink-0">Title</span>
                    ) : item.type === "project" ? (
                      <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const newSidebar = [...localSidebar];
                        newSidebar[idx].name = e.target.value;
                        setLocalSidebar(newSidebar);
                      }}
                      className="border-none bg-transparent focus:ring-0 focus:outline-none focus:bg-slate-50 px-1 py-0.5 rounded w-1/3 font-medium"
                      placeholder="Display Name"
                    />

                    {item.type !== "title" && (
                      <select
                        value={item.targetId || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newSidebar = [...localSidebar];
                          newSidebar[idx].targetId = val;
                          
                          // automatically set type to link if it starts with link-
                          if (val.startsWith("link-")) {
                            newSidebar[idx].type = "link";
                            newSidebar[idx].iconName = val.replace("link-", "");
                          } else {
                            newSidebar[idx].type = "project";
                          }
                          
                          setLocalSidebar(newSidebar);
                        }}
                        className="border-slate-200 rounded text-xs bg-slate-50 border focus:ring-blue-500 focus:border-blue-500 text-slate-600 bg-transparent flex-1"
                      >
                        <option value="">-- Select Target --</option>
                        <optgroup label="Projects">
                          {localProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="External Links">
                          <option value="link-linkedin">LinkedIn</option>
                          <option value="link-instagram">Instagram</option>
                          <option value="link-facebook">Facebook</option>
                          <option value="link-youtube">YouTube</option>
                        </optgroup>
                      </select>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setLocalSidebar(localSidebar.filter(i => i.id !== item.id))}
                    className="ml-3 p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-md transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Reorder.Item>
              ))}
            </Reorder.Group>
            
            {localSidebar.length === 0 && (
              <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
                Sidebar is empty. Add a title or folder to get started.
              </div>
            )}
          </div>
        )}
      </main>

      {processEditorOpen && (
        <ProcessEditorModal
          initialValue={
            localProjects.find(p => p.id === processEditorOpen.projectId)?.gallery[processEditorOpen.imageIndex]?.processInfoHtml || ''
          }
          onSave={(value) => {
            const finalValue = (value === '<p><br></p>' || !value.trim()) ? '' : value;
            updateImageField(processEditorOpen.projectId, processEditorOpen.imageIndex, "processInfoHtml", finalValue);
            setProcessEditorOpen(null);
          }}
          onClose={() => setProcessEditorOpen(null)}
        />
      )}
    </div>
  );
}
