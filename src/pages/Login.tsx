import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('admin@roameo.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0f9fa 0%, #ffffff 50%, #e8f4f6 100%)' }}>
        <div
          className="h-9 w-9 rounded-full border-2 border-roameoPrimary"
          style={{ borderTopColor: 'transparent', animation: 'spin-ring 0.75s linear infinite' }}
        />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(135deg, #f0f9fa 0%, #ffffff 50%, #e8f4f6 100%)' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-8 animate-fade-in-up">
        <img
          src="/roameo-logo.png"
          alt="Roameo Resorts & Hotels"
          className="h-20 w-auto object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (fb) fb.style.display = 'block';
          }}
        />
        {/* SVG teal logo fallback — shown if png missing */}
        <img
          src="/logo-teal.svg"
          alt="Roameo"
          className="h-14 w-auto object-contain hidden"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (fb) fb.style.display = 'block';
          }}
        />
        {/* Text fallback */}
        <div style={{ display: 'none' }}>
          <p
            className="text-[32px] font-bold tracking-[0.16em] text-roameoDark leading-none"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            ROAMEO
          </p>
          <p className="text-[10px] tracking-[0.24em] text-roameoMuted uppercase mt-2">Resorts &amp; Hotels</p>
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-md animate-fade-in-up"
        style={{ animationDelay: '80ms' }}
      >
        <div
          className="bg-white rounded-2xl px-8 py-10"
          style={{
            boxShadow: '0 4px 6px -1px rgba(79,111,118,0.08), 0 20px 50px -10px rgba(79,111,118,0.14)',
            border: '1px solid rgba(212,230,234,0.7)',
          }}
        >
          {/* Heading */}
          <div className="mb-8 text-center">
            <h2 className="text-[22px] font-bold text-slate-800 tracking-tight leading-tight">
              Welcome back
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Sign in to your Roameo account
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-sm leading-snug">{error}</p>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@roameo.com"
                  className="w-full pl-10 pr-4 py-3 text-sm text-slate-800 rounded-xl border border-roameoBorder bg-roameoSurface placeholder-slate-400 outline-none transition-all duration-150 focus:bg-white focus:border-roameoPrimary focus:ring-2 focus:ring-roameoPrimary/20"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 text-sm text-slate-800 rounded-xl border border-roameoBorder bg-roameoSurface placeholder-slate-400 outline-none transition-all duration-150 focus:bg-white focus:border-roameoPrimary focus:ring-2 focus:ring-roameoPrimary/20"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 mt-2 py-3 px-4 text-sm font-semibold text-white rounded-xl transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-roameoPrimary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: isSubmitting
                  ? '#6F8F97'
                  : 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)',
                boxShadow: '0 4px 14px rgba(79,111,118,0.35)',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #5f7f87 0%, #3d5c63 100%)';
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)';
              }}
            >
              {isSubmitting ? (
                <>
                  <span
                    className="h-4 w-4 rounded-full border-2 border-white/30"
                    style={{ borderTopColor: 'white', animation: 'spin-ring 0.75s linear infinite' }}
                  />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} Roameo Resorts &amp; Hotels · All rights reserved
        </p>
      </div>
    </div>
  );
};
