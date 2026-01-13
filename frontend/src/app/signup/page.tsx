'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/signup', { email, password });
      localStorage.setItem('token', res.data.access_token);
      router.push('/dashboard');
    } catch (err) {
      alert('Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-white dark:bg-black transition-colors duration-300">
      <div className="w-full max-w-md space-y-8 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 shadow-xl dark:shadow-none">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl mb-4 flex items-center justify-center">
             <Image src="/logo.png" alt="Susalabs" width={40} height={40} className="object-cover" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Create Account</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Join the Susalabs Security Community</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Email address"
              />
            </div>
            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Sign up'}
            </button>
          </div>
        </form>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
