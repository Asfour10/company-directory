import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BrandedButton } from './BrandedButton';
import { useTouchGestures } from '../hooks/useTouchGestures';

interface NavigationItem {
  key: string;
  label: string;
  href: string;
  show: boolean;
  icon?: React.ReactNode;
}

export const Navigation: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
  const isSuperAdmin = user && user.role === 'super_admin';

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Touch gesture support for mobile menu
  const { elementRef: menuTouchRef } = useTouchGestures({
    onSwipeUp: () => setMobileMenuOpen(false),
    onTap: (e) => {
      // Close menu if tapping on backdrop
      if (e?.target === mobileMenuRef.current) {
        setMobileMenuOpen(false);
      }
    }
  });

  const navigationItems: NavigationItem[] = [
    {
      key: 'directory',
      label: 'Employee Directory',
      href: '/directory',
      show: true,
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      key: 'search',
      label: 'Search',
      href: '/search',
      show: true,
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      key: 'admin',
      label: 'Analytics',
      href: '/admin',
      show: !!isAdmin,
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      key: 'employees',
      label: 'Manage Employees',
      href: '/admin/employees',
      show: !!isAdmin,
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      )
    },
    {
      key: 'fields',
      label: 'Custom Fields',
      href: '/admin/custom-fields',
      show: !!isAdmin,
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      key: 'audit',
      label: 'Audit Logs',
      href: '/admin/audit-logs',
      show: !!isAdmin,
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      key: 'settings',
      label: 'Settings',
      href: '/admin/settings',
      show: !!isSuperAdmin,
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ].filter(item => item.show);

  const isCurrentPath = (href: string) => {
    if (href === '/directory' && location.pathname === '/') return true;
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const currentItem = navigationItems.find(item => isCurrentPath(item.href));

  return (
    <nav role="navigation" aria-label="Main navigation">
      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <div className="container-mobile py-3 sm:py-4">
          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-between w-full p-3 sm:p-4 bg-white rounded-lg shadow-sm border border-gray-200 touch-target tap-highlight-primary"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
            aria-controls="mobile-navigation-menu"
          >
            <div className="flex items-center space-x-3">
              {currentItem?.icon}
              <span className="text-responsive-sm font-medium text-gray-900">
                {currentItem?.label || 'Menu'}
              </span>
            </div>
            <svg 
              className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${mobileMenuOpen ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {/* Mobile menu overlay */}
          {mobileMenuOpen && (
            <div 
              ref={mobileMenuRef}
              className="fixed inset-0 z-50 lg:hidden"
              aria-modal="true"
              role="dialog"
              aria-labelledby="mobile-menu-title"
            >
              {/* Backdrop */}
              <div className="fixed inset-0 bg-black bg-opacity-25" />
              
              {/* Menu panel */}
              <div 
                ref={menuTouchRef as React.RefObject<HTMLDivElement>}
                className="fixed inset-x-0 top-0 z-50 bg-white shadow-xl safe-top"
                id="mobile-navigation-menu"
              >
                {/* Menu header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h2 id="mobile-menu-title" className="text-responsive-lg font-semibold text-gray-900">Navigation</h2>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 touch-target-sm tap-highlight-none"
                    aria-label="Close menu"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Menu items */}
                <div className="py-2 max-h-screen overflow-y-auto scroll-smooth-mobile">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.key}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`mobile-nav-item text-responsive-sm transition-colors duration-150 ${
                        isCurrentPath(item.href) 
                          ? 'bg-blue-50 text-blue-700 font-medium border-r-4 border-blue-600' 
                          : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                      }`}
                      aria-current={isCurrentPath(item.href) ? 'page' : undefined}
                    >
                      <div className="flex items-center space-x-3 w-full">
                        {item.icon}
                        <span className="flex-1">{item.label}</span>
                        {isCurrentPath(item.href) && (
                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden lg:block container-mobile py-4">
        <div className="flex space-x-2 xl:space-x-4 border-b border-gray-200 pb-4 overflow-x-auto scroll-smooth-mobile">
          {navigationItems.map((item) => (
            <Link key={item.key} to={item.href}>
              <BrandedButton
                variant={isCurrentPath(item.href) ? 'primary' : 'ghost'}
                className="whitespace-nowrap text-responsive-sm flex items-center space-x-2 touch-target"
                aria-current={isCurrentPath(item.href) ? 'page' : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
              </BrandedButton>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;