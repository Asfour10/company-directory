import React, { useState } from 'react';
import { Employee } from '../types/api';
import { EmployeeProfileModal } from './EmployeeProfileModal';
import { EmployeeEditModal } from './EmployeeEditModal';

interface EmployeeProfileWithEditProps {
  employeeId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Component that demonstrates the integration between EmployeeProfileModal and EmployeeEditModal
 * This shows how the profile edit form can be triggered from the profile view
 */
export const EmployeeProfileWithEdit: React.FC<EmployeeProfileWithEditProps> = ({
  employeeId,
  isOpen,
  onClose
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);

  const handleEdit = (employee: Employee) => {
    setEmployeeToEdit(employee);
    setShowEditModal(true);
  };

  const handleEditClose = () => {
    setShowEditModal(false);
    setEmployeeToEdit(null);
  };

  const handleEditSave = (updatedEmployee: Employee) => {
    // The edit modal will close automatically after successful save
    // You could also refresh the profile modal here if needed
    console.log('Employee updated:', updatedEmployee);
  };

  return (
    <>
      {/* Profile View Modal */}
      <EmployeeProfileModal
        employeeId={employeeId}
        isOpen={isOpen && !showEditModal}
        onClose={onClose}
        onEdit={handleEdit}
      />

      {/* Edit Modal */}
      {employeeToEdit && (
        <EmployeeEditModal
          employee={employeeToEdit}
          isOpen={showEditModal}
          onClose={handleEditClose}
          onSave={handleEditSave}
        />
      )}
    </>
  );
};