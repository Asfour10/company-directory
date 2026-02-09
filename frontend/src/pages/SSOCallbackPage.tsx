import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthService } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';

export const SSOCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const provider = searchParams.get('provider') || 'azure';
        const errorParam = searchParams.get('error');

        if (errorParam) {
          setError(`Authentication failed: ${searchParams.get('error_description') || errorParam}`);
          setIsProcessing(false);
          return;
        }

        if (!code) {
          setError('No authorization code received from SSO provider');
          setIsProcessing(false);
          return;
        }

        // Handle the SSO callback
        const { token } = await AuthService.handleSSOCallback(provider, code, state || undefined);
        
        // Store the token
        localStorage.setItem('authToken', token);
        
        // Redirect to the main app
        navigate('/', { replace: true });
      } catch (err: any) {
        console.error('SSO callback error:', err);
        setError(err.response?.data?.error?.message || 'Authentication failed. Please try again.');
        setIsProcessing(false);
      }
    };

    // Only process if we don't already have a user
    if (!user) {
      handleCallback();
    } else {
      // User is already authenticated, redirect to main app
      navigate('/', { replace: true });
    }
  }, [searchParams, navigate, user]);

  const handleRetry = () => {
    navigate('/login', { replace: true });
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <h2 className="mt-6 text-xl font-semibold text-gray-900">
            Completing sign in...
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please wait while we verify your credentials.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="rounded-full h-12 w-12 bg-red-100 mx-auto flex items-center justify-center">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="mt-6 text-xl font-semibold text-gray-900">
            Authentication Failed
          </h2>
          <p className="mt-2 text-sm text-gray-600 mb-6">
            {error}
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
};