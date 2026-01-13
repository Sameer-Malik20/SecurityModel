'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Navbar from '@/components/Navbar';
import { Github, Key, CheckCircle, AlertTriangle } from 'lucide-react';

export default function SetupPage() {
  const [token, setToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/auth/me');
      setIsConnected(res.data.has_github_token);
    } catch (err) {}
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/github-token', { token });
      setIsConnected(true);
      setToken('');
      alert('Token updated securely!');
    } catch (err) {
      alert('Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors pb-20 text-gray-900 dark:text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 mt-12">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-gray-200 dark:border-blue-500/20 shadow-xl dark:shadow-none">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-3 bg-blue-600/10 dark:bg-blue-600/20 rounded-xl text-blue-600 dark:text-blue-500">
              <Github size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">GitHub Integration</h1>
              <p className="text-gray-600 dark:text-gray-400">Connect your repository to enable AI security analysis</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-500/20 p-4 rounded-xl flex space-x-3">
                <AlertTriangle className="text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <span className="font-bold">Important:</span> Only use a <strong>READ-ONLY</strong> Personal Access Token. We only need access to repository contents to fetch code for analysis.
                </p>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>1. Go to GitHub Settings -&gt; Developer Settings -&gt; Personal Access Tokens</p>
                <p>2. Generate a new token (classic) with `repo` read access.</p>
                <p>3. Paste the token here. It will be encrypted at rest.</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-xl border border-gray-200 dark:border-white/5">
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="relative">
                  <Key className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-3 outline-none focus:border-blue-500 text-gray-900 dark:text-white transition-all"
                  />
                </div>
                <button
                  disabled={loading || !token}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-all shadow-lg shadow-blue-600/20"
                >
                  {loading ? 'Saving...' : 'Connect GitHub'}
                </button>
              </form>

              {isConnected && (
                <div className="mt-6 flex items-center justify-center space-x-2 text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-900/10 py-2 rounded-lg border border-green-200 dark:border-green-500/20">
                  <CheckCircle size={18} />
                  <span className="text-sm font-medium">GitHub Connected</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
