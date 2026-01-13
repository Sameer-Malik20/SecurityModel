'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { Plus, Server, Code, FileText, ExternalLink, ShieldAlert, Edit, Trash2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  repo_url: string;
  deploy_url?: string;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', repo_url: '', deploy_url: '' });
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [scanning, setScanning] = useState<Record<string, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/projects', newProject);
      setShowAddModal(false);
      setNewProject({ name: '', repo_url: '', deploy_url: '' });
      fetchProjects();
    } catch (err) {
      alert('Failed to add project');
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    try {
      await api.put(`/projects/${editingProject.id}`, {
        name: editingProject.name,
        repo_url: editingProject.repo_url,
        deploy_url: editingProject.deploy_url,
      });
      setShowEditModal(false);
      setEditingProject(null);
      fetchProjects();
    } catch (err) {
      alert('Failed to update project');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? All associated scans will also be deleted.')) return;
    try {
      await api.delete(`/projects/${projectId}`);
      fetchProjects();
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  const handleScanNow = async (projectId: string, type: 'full' | 'code' | 'runtime' = 'full') => {
    const key = `${projectId}-${type}`;
    setScanning(prev => ({ ...prev, [key]: true }));
    try {
      const res = await api.post(`/projects/${projectId}/scan`, { type });
      alert(`${type.toUpperCase()} scan triggered! Redirecting...`);
      router.push(`/scans/${res.data.id}`);
    } catch (err) {
      console.error(err);
      alert('Scan failed to start.');
    } finally {
      setScanning(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 mt-12 mb-20 text-gray-900 dark:text-white">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Security Command Center</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Granular control over code and runtime assets</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2.5 rounded-xl flex items-center space-x-2 font-semibold transition-all shadow-lg shadow-blue-900/20"
          >
            <Plus size={20} />
            <span>Add Project</span>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-64 glass rounded-2xl" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="glass p-20 rounded-[2.5rem] text-center border-dashed border-white border-opacity-10">
            <div className="mx-auto w-16 h-16 bg-white bg-opacity-5 rounded-full flex items-center justify-center mb-4">
              <Server className="text-gray-500" />
            </div>
            <h3 className="text-xl font-bold">No assets engaged</h3>
            <p className="text-gray-400 mt-2 max-w-sm mx-auto">Connect your workspace to start modular security audits.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div key={project.id} className="bg-white dark:bg-zinc-900 p-7 rounded-[2.5rem] border border-gray-200 dark:border-white/5 hover:border-blue-500/20 transition-all group relative shadow-sm hover:shadow-xl dark:shadow-none">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-gray-100 dark:bg-white/5 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <ShieldAlert size={24} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => {
                        setEditingProject(project);
                        setShowEditModal(true);
                      }}
                      className="text-gray-500 hover:text-blue-400 p-2 transition-colors"
                      title="Edit Project"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteProject(project.id)}
                      className="text-gray-500 hover:text-red-500 p-2 transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 size={18} />
                    </button>
                    <Link href={`/projects/${project.id}`} className="text-gray-500 hover:text-white p-2">
                      <ExternalLink size={18} />
                    </Link>
                  </div>
                </div>
                
                <h3 className="text-xl font-black mb-1 truncate">{project.name}</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-6">Asset ID: {project.id.slice(-8)}</p>
                
                <div className="space-y-3 mb-8">
                   {/* CODE SECTION */}
                   <div className="group/row flex items-center justify-between bg-gray-50 dark:bg-white/[0.03] p-3 rounded-2xl border border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-all">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <Code size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate tracking-tighter">{project.repo_url}</span>
                      </div>
                      <button 
                        disabled={scanning[`${project.id}-code`]}
                        onClick={() => handleScanNow(project.id, 'code')}
                        className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-lg hover:bg-blue-500 hover:text-white transition-all shrink-0"
                      >
                         {scanning[`${project.id}-code`] ? '...' : 'SCAN'}
                      </button>
                   </div>

                   {/* RUNTIME SECTION */}
                   {project.deploy_url && (
                     <div className="group/row flex items-center justify-between bg-white/[0.03] p-3 rounded-2xl border border-white/5 hover:bg-white/[0.05] transition-all">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <Server size={16} className="text-green-400 shrink-0" />
                          <span className="text-xs font-mono text-gray-400 truncate tracking-tighter">{project.deploy_url}</span>
                        </div>
                        <button 
                          disabled={scanning[`${project.id}-runtime`]}
                          onClick={() => handleScanNow(project.id, 'runtime')}
                          className="text-[10px] font-black text-green-500 bg-green-500/10 px-3 py-1.5 rounded-lg hover:bg-green-500 hover:text-white transition-all shrink-0"
                        >
                           {scanning[`${project.id}-runtime`] ? '...' : 'LIVE'}
                        </button>
                     </div>
                   )}
                </div>
                
                <div className="flex space-x-3">
                  <Link 
                    href={`/projects/${project.id}`}
                    className="flex-1 text-center py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    History
                  </Link>
                  <button 
                    disabled={scanning[`${project.id}-full`]}
                    onClick={() => handleScanNow(project.id, 'full')}
                    className="flex-[2] py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/10"
                  >
                    {scanning[`${project.id}-full`] ? 'SCANNING...' : 'FULL SECURITY AUDIT'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-black/90 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl relative overflow-hidden text-gray-900 dark:text-white">
            {/* Background Accent */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
            
            <h2 className="text-3xl font-black mb-2">Engage New Asset</h2>
            <p className="text-sm text-gray-400 mb-10">Configure your security boundary by adding a repository or deploy URL.</p>
            
            <form onSubmit={handleAddProject} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Project Identity</label>
                  <input
                    required
                    placeholder="e.g. Production Web Core"
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm font-medium"
                    value={newProject.name}
                    onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Source Repository (GitHub)</label>
                  <input
                    required
                    placeholder="https://github.com/org/repo"
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm font-mono"
                    value={newProject.repo_url}
                    onChange={(e) => setNewProject({...newProject, repo_url: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Live Deploy URL (Optional)</label>
                  <input
                    placeholder="https://app.example.com"
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm font-mono"
                    value={newProject.deploy_url}
                    onChange={(e) => setNewProject({...newProject, deploy_url: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="flex space-x-4 pt-6">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20"
                >
                  Initialize Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showEditModal && editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-black/90 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl relative overflow-hidden text-gray-900 dark:text-white">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
            
            <h2 className="text-3xl font-black mb-2">Refine Asset</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-10">Update your project configuration and security parameters.</p>
            
            <form onSubmit={handleEditProject} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Project Identity</label>
                  <input
                    required
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm font-medium"
                    value={editingProject.name}
                    onChange={(e) => setEditingProject({...editingProject, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Source Repository</label>
                  <input
                    required
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm font-mono"
                    value={editingProject.repo_url}
                    onChange={(e) => setEditingProject({...editingProject, repo_url: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Live Deploy URL (Optional)</label>
                  <input
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm font-mono"
                    value={editingProject.deploy_url || ''}
                    onChange={(e) => setEditingProject({...editingProject, deploy_url: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="flex space-x-4 pt-6">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProject(null);
                  }}
                  className="flex-1 py-4 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
