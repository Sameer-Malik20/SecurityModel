'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { History, Shield, Play, ChevronRight, Clock, Info, Edit, Trash2 } from 'lucide-react';

interface Scan {
  id: string;
  created_at: string;
}

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  useEffect(() => {
    fetchProjectAndScans();
  }, [id]);

  const fetchProjectAndScans = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/scans`)
      ]);
      setProject(pRes.data);
      setEditingProject(pRes.data);
      setScans(sRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunScan = async () => {
    setScanning(true);
    try {
      const res = await api.post(`/projects/${id}/scan`);
      alert('Scan initiated successfully!');
      router.push(`/scans/${res.data.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to start scan.');
    } finally {
      setScanning(false);
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/projects/${id}`, {
        name: editingProject.name,
        repo_url: editingProject.repo_url,
        deploy_url: editingProject.deploy_url,
      });
      setShowEditModal(false);
      fetchProjectAndScans();
    } catch (err) {
      alert('Failed to update project');
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project? All associated scans will also be deleted.')) return;
    try {
      await api.delete(`/projects/${id}`);
      router.push('/dashboard');
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 mt-12 mb-20 text-gray-900 dark:text-white">
        {project && (
          <div className="flex items-center space-x-4 mb-10">
            <Link href="/dashboard" className="p-2 hover:bg-white hover:bg-opacity-5 rounded-lg text-gray-400">
               <ChevronRight className="rotate-180" />
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{project.name}</h1>
              <p className="text-gray-400 font-mono text-sm">{project.repo_url}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setShowEditModal(true)}
                className="p-3 bg-gray-100 dark:bg-white/5 hover:bg-blue-600/10 dark:hover:bg-blue-600/20 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all"
                title="Edit Project"
              >
                <Edit size={20} />
              </button>
              <button 
                onClick={handleDeleteProject}
                className="p-3 bg-gray-100 dark:bg-white/5 hover:bg-red-600/10 dark:hover:bg-red-600/20 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all"
                title="Delete Project"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-xl font-bold flex items-center space-x-2">
              <History size={20} className="text-blue-500" />
              <span>Scan History</span>
            </h2>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-20 glass rounded-xl animate-pulse" />)}
              </div>
            ) : scans.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 p-12 rounded-2xl text-center border-dashed border-gray-200 dark:border-white/5 shadow-sm">
                <Clock size={40} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No scans performed yet.</p>
                <button 
                  disabled={scanning}
                  onClick={handleRunScan}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 transition-all"
                >
                  {scanning ? 'Starting...' : 'Start First Scan'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {scans.map(scan => (
                  <Link 
                    key={scan.id} 
                    href={`/scans/${scan.id}`}
                    className="block bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-blue-500 dark:hover:border-opacity-30 transition-all hover:translate-x-1 shadow-sm hover:shadow-md"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <div className="bg-green-500 bg-opacity-10 text-green-500 p-2 rounded-lg">
                          <Shield size={20} />
                        </div>
                        <div>
                          <p className="font-bold">Full Security Scan #{scan.id}</p>
                          <p className="text-sm text-gray-500">{new Date(scan.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-gray-600" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center space-x-2 text-gray-900 dark:text-white">
                <Play size={18} className="text-green-500" />
                <span>Quick Actions</span>
              </h3>
              <button 
                disabled={scanning}
                onClick={handleRunScan}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all mb-3 text-sm disabled:opacity-50 shadow-lg shadow-blue-600/20"
              >
                {scanning ? 'Running...' : 'Run Automated Scan'}
              </button>
              <button className="w-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-medium transition-all text-sm">
                Upload Custom Report
              </button>
            </div>

            <div className="glass p-6 rounded-2xl bg-blue-500 bg-opacity-[0.03] border-blue-500 border-opacity-10">
              <h3 className="font-bold mb-2 flex items-center space-x-2 text-blue-400">
                <Info size={16} />
                <span>Integration Status</span>
              </h3>
              <p className="text-sm text-gray-400">
                This project is connected to GitHub. AI fixes will draw context from the <strong>main</strong> branch.
              </p>
            </div>
          </div>
        </div>
      </div>
      {showEditModal && editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-black/90 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl relative overflow-hidden text-gray-900 dark:text-white">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
            
            <h2 className="text-3xl font-black mb-2 text-white">Refine Asset</h2>
            <p className="text-sm text-gray-400 mb-10">Update your project configuration and security parameters.</p>
            
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
                  onClick={() => setShowEditModal(false)}
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
