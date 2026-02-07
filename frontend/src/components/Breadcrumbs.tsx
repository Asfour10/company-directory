import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  const location = useLocation();

  // Auto-generate breadcrumbs if not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Home', href: '/directory' }
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      // Map path segments to readable labels
      let label = segment;
      switch (segment) {
        case 'directory':
          label = 'Employee Directory';
          break;
        case 'search':
          label = 'Search';
          break;
        case 'admin':
          label = 'Admin';
          break;
        case 'employees':
          label = 'Employees';
          break;
        case 'custom-fields':
          label = 'Custom Fields';
          break;
        case 'audit-logs':
          label = 'Audit Logs';
          break;
        case 'settings':
          label = 'Settings';
          break;
        case 'edit':
          label = 'Edit';
          break;
        case 'branding':
          label = 'Branding Demo';
          break;
        default:
          // For IDs, try to make them more readable
          if (segment.match(/^[a-f0-9-]{36}$/)) {
            label = 'Profile';
          } else if (segment.match(/^\d+$/)) {
            label = `Item ${segment}`;
          } else {
            label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
          }
      }

      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
        current: isLast
      });
    });

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();

  if (breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <nav className={`flex ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1 sm:space-x-2" role="list">
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <svg
                className="flex-shrink-0 h-4 w-4 text-gray-400 mx-1 sm:mx-2"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            
            {item.current ? (
              <span 
                className="text-sm font-medium text-gray-500 truncate max-w-[100px] sm:max-w-none"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href || '#'}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 truncate max-w-[100px] sm:max-w-none transition-colors duration-150"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;