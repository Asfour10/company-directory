import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BrandedButton } from '../components/BrandedButton';
import { useBranding } from '../contexts/BrandingContext';

export const LoginPage: React.FC = () => {
  const { login, loginWithSSO, isLoading } = useAuth();
  const { theme } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginMethod, setLoginMethod] = useState<'credentials' | 'sso'>('sso');

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed. Please try again.');
    }
  };

  const handleSSOLogin = async (provider: string) => {
    setError('');
    try {
      await loginWithSSO(provider);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'SSO login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-auto flex justify-center">
            {theme.logoUrl ? (
              <img
                className="h-12 w-auto"
                src={theme.logoUrl}
                alt={theme.tenantName || 'Company Logo'}
              />
            ) : (
              <div 
                className="h-12 px-4 flex items-center justify-center rounded-lg text-white font-bold text-lg"
                style={{ backgroundColor: theme.primaryColor || '#3B82F6' }}
              >
                {theme.tenantName || 'Directory'}
              </div>
            )}
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access your company directory
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Login Method Toggle */}
          <div className="flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => setLoginMethod('sso')}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                loginMethod === 'sso'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
              }`}
            >
              SSO Login
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('credentials')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg border-t border-r border-b ${
                loginMethod === 'credentials'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Email & Password
            </button>
          </div>

          {loginMethod === 'sso' ? (
            /* SSO Login Options */
            <div className="space-y-3">
              <BrandedButton
                onClick={() => handleSSOLogin('azure')}
                disabled={isLoading}
                className="w-full flex justify-center items-center"
                variant="outline"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
                </svg>
                Continue with Microsoft
              </BrandedButton>

              <BrandedButton
                onClick={() => handleSSOLogin('google')}
                disabled={isLoading}
                className="w-full flex justify-center items-center"
                variant="outline"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </BrandedButton>

              <BrandedButton
                onClick={() => handleSSOLogin('okta')}
                disabled={isLoading}
                className="w-full flex justify-center items-center"
                variant="outline"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Continue with Okta
              </BrandedButton>
            </div>
          ) : (
            /* Credential Login Form */
            <form className="mt-8 space-y-6" onSubmit={handleCredentialLogin}>
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <label htmlFor="email-address" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <BrandedButton
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center"
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </BrandedButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};