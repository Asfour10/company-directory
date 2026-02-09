import React, { useState, useRef, useEffect } from 'react';
import { useBranding } from '../contexts/BrandingContext';
import { useAuth } from '../contexts/AuthContext';
import { OptimizedImage } from './OptimizedImage';

interface HeaderProps {
  title?: string;
  showLogo?: boolean;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ 
  title, 
  showLogo = true, 
  className = '' 
}) => {
  const { theme, isLoading } = useBranding();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className={`bg-white shadow-sm border-b border-gray-200 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo and Title Section */}
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            {showLogo && (
              <div className="flex-shrink-0">
                {isLoading ? (
                  // Loading placeholder
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-200 rounded animate-pulse" />
                ) : theme.logoUrl ? (
                  // Custom tenant logo
                  <OptimizedImage
                    src={theme.logoUrl}
                    alt={`${theme.tenantName || 'Company'} Logo`}
                    className="h-8 sm:h-10 w-auto max-w-[120px] sm:max-w-[200px] object-contain"
                    fallback={
                      <div 
                        className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg"
                        style={{ 
                          backgroundColor: theme.primaryColor || '#3B82F6',
                          color: 'white'
                        }}
                      >
                        <span className="text-sm sm:text-lg font-bold">
                          {(theme.tenantName || 'CD').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    }
                    sizes="(max-width: 640px) 120px, 200px"
                  />
                ) : null}
                
                {/* Default logo fallback */}
                <div 
                  className={`${theme.logoUrl ? 'hidden' : 'flex'} items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg`}
                  style={{ 
                    backgroundColor: theme.primaryColor || '#3B82F6',
                    color: 'white'
                  }}
                >
                  <span className="text-sm sm:text-lg font-bold">
                    {(theme.tenantName || 'CD').charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
            
            {/* Title */}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {title || theme.tenantName || 'Company Directory'}
              </h1>
            </div>
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            {/* Subdomain - hidden on mobile */}
            {theme.subdomain && (
              <div className="text-xs sm:text-sm text-gray-500 hidden md:block">
                {theme.subdomain}.directory.com
              </div>
            )}
            
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-1 sm:space-x-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-md p-1 sm:p-2"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-xs sm:text-sm font-medium text-gray-700">
                      {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </span>
                  </div>
                  <span className="hidden sm:block max-w-[120px] lg:max-w-none truncate">
                    {user.firstName} {user.lastName}
                  </span>
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* User dropdown menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                      <div className="font-medium truncate">{user.firstName} {user.lastName}</div>
                      <div className="text-gray-500 truncate">{user.email}</div>
                      <div className="text-xs text-gray-400 capitalize">{user.role}</div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;