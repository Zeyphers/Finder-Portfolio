import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppletData } from "./DataContext";
import { Folder, Upload, Trash2, Edit2, Plus, Save, LogOut, Link2, FileVideo, Check, RefreshCw, Share, User } from "lucide-react";
import { Project, GalleryImage, AboutInfo } from "./types";
import { getApiUrl, getImageUrl } from "./api";
import { ProgressiveImage } from "./components/ProgressiveImage";

export function AdminPanel() {
  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const { projects, about, refreshData } = useAppletData();
  const [localProjects, setLocalProjects] = useState<Project[]>(projects);
  const [localAbout, setLocalAbout] = useState<AboutInfo>(about);
  const [activeTab, setActiveTab] = useState<"folders" | "about">("folders");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setLocalProjects(JSON.parse(JSON.stringify(projects)));
  }, [projects]);

  useEffect(() => {
    if (about) {
      setLocalAbout(JSON.parse(JSON.stringify(about)));
    }
  }, [about]);

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
        localStorage.setItem("adminToken", data.token);
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
    localStorage.removeItem("adminToken");
    setToken("");
    navigate("/");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentRemoteDataRes = await fetch(getApiUrl("/api/data"));
      const currentRemoteData = await currentRemoteDataRes.json();
      
      console.log("Saving to:", getApiUrl("/api/data"));
      const res = await fetch(getApiUrl("/api/data"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          PROJECTS: localProjects, 
          EXTERNAL_LINKS: currentRemoteData.EXTERNAL_LINKS,
          ABOUT: localAbout
        })
      });
      console.log("Save response status:", res.status);
      if (res.ok) {
        const resultData = await res.json();
        console.log("Save result:", resultData);
        await refreshData();
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      } else {
        const errText = await res.text();
        console.error("Save error response:", errText);
        alert(`Failed to save data: ${errText}`);
      }
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
          gallery: [...p.gallery, { url: "https://img.youtube.com/vi/default/hqdefault.jpg", caption: "New Video", isVideo: true, videoUrl: "https://www.youtube.com/watch?v=gB9mSyxdhyQ" }]
        };
      }
      return p;
    }));
  };

  const handleFolderIconUpload = async (projectId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(getApiUrl("/api/upload"), {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        updateFolder(projectId, { folderIconImage: data.url });
      } else {
        alert("Upload failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error("Upload error", err);
      alert("Upload error: " + (err.message || String(err)));
    }
    e.target.value = "";
  };

  const handleFileUpload = async (projectId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newGalleryItems: { url: string, caption: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(getApiUrl("/api/upload"), {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          newGalleryItems.push({ url: data.url, caption: "New Image" });
        } else {
          alert("Upload failed for " + file.name + ": " + (data.error || "Unknown error"));
        }
      }
      
      if (newGalleryItems.length > 0) {
        setLocalProjects(localProjects.map(p => {
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
    
    e.target.value = "";
  };

  const updateImageField = (projectId: string, imageIndex: number, field: "caption" | "videoUrl", value: string) => {
    setLocalProjects(localProjects.map(proj => {
      if (proj.id === projectId) {
        const newGallery = [...proj.gallery];
        newGallery[imageIndex] = { ...newGallery[imageIndex], [field]: value };
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

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
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
        <div className="flex space-x-1 border border-slate-200 mb-6 bg-slate-100 p-1 rounded-lg max-w-xs sm:max-w-sm">
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
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Folder Description</label>
                      <textarea 
                        value={project.description} 
                        onChange={e => updateFolder(project.id, { description: e.target.value })} 
                        rows={4}
                        className="w-full border-slate-300 rounded-md shadow-sm p-2 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 border focus:outline-none resize-none text-sm"
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

              <div className="p-4 sm:p-6">
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
                          
                          {/* Desktop Image Controls overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                            <button onClick={() => deleteImage(project.id, index)} className="p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full transition" title="Delete Media">
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
      </main>
    </div>
  );
}
