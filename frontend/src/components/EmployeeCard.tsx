import React from 'react';
import { Link } from 'react-router-dom';
import { Employee } from '../types/api';
import { OptimizedImage } from './OptimizedImage';
import { useTouchGestures } from '../hooks/useTouchGestures';

interface EmployeeCardProps {
  employee: Employee;
  onClick?: () => void;
  viewMode?: 'grid' | 'list';
  enableNavigation?: boolean;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee,
  onClick,
  viewMode = 'grid',
  enableNavigation = false
}) => {
  const handleClick = (e?: React.MouseEvent) => {
    if (!enableNavigation && e) {
      e.preventDefault();
    }
    if (onClick) {
      onClick();
    }
  };

  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`;

  // Touch gesture support
  const { elementRef: touchRef } = useTouchGestures({
    onTap: () => handleClick(),
    onLongPress: () => {
      // Could show context menu or additional actions
      console.log('Long press on employee card:', employee.firstName, employee.lastName);
    }
  });

  const ProfilePhotoFallback = ({ size }: { size: string }) => (
    <div className={`${size} rounded-full bg-gray-300 flex items-center justify-center`}>
      <span className={`${size.includes('12') ? 'text-responsive-xs' : 'text-responsive-sm'} font-medium text-gray-700`}>
        {initials}
      </span>
    </div>
  );

  const CardContent = ({ children }: { children: React.ReactNode }) => {
    if (enableNavigation) {
      return (
        <Link
          to={`/employees/${employee.id}`}
          className="block"
          onClick={handleClick}
        >
          {children}
        </Link>
      );
    }
    
    return (
      <div onClick={() => handleClick()} className="cursor-pointer">
        {children}
      </div>
    );
  };

  if (viewMode === 'list') {
    return (
      <div
        ref={touchRef as React.RefObject<HTMLDivElement>}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow touch-manipulation"
      >
        <CardContent>
          <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Profile Photo */}
          <div className="flex-shrink-0">
            {employee.profilePhotoUrl ? (
              <OptimizedImage
                src={employee.profilePhotoUrl}
                alt={`${employee.firstName} ${employee.lastName}`}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover"
                fallback={<ProfilePhotoFallback size="h-10 w-10 sm:h-12 sm:w-12" />}
                sizes="(max-width: 640px) 40px, 48px"
              />
            ) : (
              <ProfilePhotoFallback size="h-10 w-10 sm:h-12 sm:w-12" />
            )}
          </div>

          {/* Employee Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-responsive-sm font-medium text-gray-900 line-clamp-1">
                  {employee.firstName} {employee.lastName}
                </p>
                {employee.title && (
                  <p className="text-responsive-xs text-gray-500 line-clamp-1">{employee.title}</p>
                )}
              </div>
              <div className="mt-1 sm:mt-0 sm:text-right sm:ml-4 flex-shrink-0">
                {employee.department && (
                  <p className="text-responsive-xs text-gray-500 line-clamp-1">{employee.department}</p>
                )}
                {employee.email && (
                  <p className="text-responsive-xs text-blue-600 hover:text-blue-500 line-clamp-1">
                    {employee.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex-shrink-0">
            <div className={`w-2 h-2 rounded-full ${employee.isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
          </div>
        </div>
        </CardContent>
      </div>
    );
  }

  return (
    <div
      ref={touchRef as React.RefObject<HTMLDivElement>}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow touch-manipulation"
    >
      <CardContent>
        <div className="flex flex-col items-center text-center">
        {/* Profile Photo */}
        <div className="mb-3 sm:mb-4">
          {employee.profilePhotoUrl ? (
            <OptimizedImage
              src={employee.profilePhotoUrl}
              alt={`${employee.firstName} ${employee.lastName}`}
              className="h-12 w-12 sm:h-16 sm:w-16 rounded-full object-cover"
              fallback={<ProfilePhotoFallback size="h-12 w-12 sm:h-16 sm:w-16" />}
              sizes="(max-width: 640px) 48px, 64px"
            />
          ) : (
            <ProfilePhotoFallback size="h-12 w-12 sm:h-16 sm:w-16" />
          )}
        </div>

        {/* Employee Info */}
        <div className="space-y-1 w-full">
          <h3 className="text-responsive-base font-medium text-gray-900 line-clamp-1">
            {employee.firstName} {employee.lastName}
          </h3>
          
          {employee.title && (
            <p className="text-responsive-xs text-gray-600 line-clamp-1">{employee.title}</p>
          )}
          
          {employee.department && (
            <p className="text-responsive-xs text-gray-500 line-clamp-1">{employee.department}</p>
          )}
          
          {employee.email && (
            <p className="text-responsive-xs text-blue-600 hover:text-blue-500 line-clamp-1">
              {employee.email}
            </p>
          )}
          
          {employee.phone && (
            <p className="text-responsive-xs text-gray-500 line-clamp-1">{employee.phone}</p>
          )}
          
          {employee.officeLocation && (
            <p className="text-responsive-xs text-gray-500 line-clamp-1">{employee.officeLocation}</p>
          )}
        </div>

        {/* Skills */}
        {employee.skills && employee.skills.length > 0 && (
          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1 justify-center">
            {employee.skills.slice(0, 3).map((skill, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-responsive-xs font-medium bg-blue-100 text-blue-800"
              >
                {skill}
              </span>
            ))}
            {employee.skills.length > 3 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-responsive-xs font-medium bg-gray-100 text-gray-800">
                +{employee.skills.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Status and Manager info */}
        <div className="mt-2 sm:mt-3 space-y-1 w-full">
          <div className="flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${employee.isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
            <span className="text-responsive-xs text-gray-500">
              {employee.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Manager info */}
          {employee.manager && (
            <div className="text-responsive-xs text-gray-500 line-clamp-1">
              Reports to {employee.manager.firstName} {employee.manager.lastName}
            </div>
          )}
        </div>
      </div>
      </CardContent>
    </div>
  );
};