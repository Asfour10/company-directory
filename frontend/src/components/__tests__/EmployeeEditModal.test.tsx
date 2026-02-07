import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmployeeEditModal } from '../EmployeeEditModal';
import { EmployeeAPI } from '../../services/employee';
import { AuthProvider } from '../../contexts/AuthContext';
import { BrandingProvider } from '../../contexts/BrandingContext';
import { Employee } from '../../types/api';

// Mock the services
jest.mock('../../services/employee', () => ({
  EmployeeAPI: {
    updateEmployee: jest.fn(),
    uploadProfilePhoto: jest.fn(),
  },
}));

jest.mock('../../services/tenant', () => ({
  TenantAPI: {
    getSettings: jest.fn(),
  },
}));

const mockEmployeeAPI = EmployeeAPI as jest.Mocked<typeof EmployeeAPI>;

// Mock employee data
const mockEmployee: Employee = {
  id: 'emp-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '+1234567890',
  title: 'Software Engineer',
  department: 'Engineering',
  officeLocation: 'New York',
  skills: ['JavaScript', 'React'],
  bio: 'Experienced software engineer',
  profilePhotoUrl: 'https://example.com/photo.jpg',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// Mock user data
const mockUser = {
  id: 'emp-1', // Same as employee to test own profile editing
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'user' as const,
  tenantId: 'tenant-1',
};

// Wrapper component with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrandingProvider>
      <AuthProvider>{children}</AuthProvider>
    </BrandingProvider>
  );
};

// Mock AuthContext
const mockAuthContext = {
  user: mockUser,
  isLoading: false,
  isAuthenticated: true,
  login: jest.fn(),
  loginWithSSO: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
};

jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => mockAuthContext,
}));

describe('EmployeeEditModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(
      <TestWrapper>
        <EmployeeEditModal
          employee={mockEmployee}
          isOpen={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </TestWrapper>
    );

    expect(screen.queryByText('Edit Profile')).not.toBeInTheDocument();
  });

  it('should render form when isOpen is true', () => {
    render(
      <TestWrapper>
        <EmployeeEditModal
          employee={mockEmployee}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument();
  });

  it('should show access denied for unauthorized users', () => {
    // Mock different user
    const unauthorizedUser = {
      ...mockUser,
      id: 'different-user',
      role: 'user' as const,
    };

    jest.mocked(mockAuthContext).user = unauthorizedUser;

    render(
      <TestWrapper>
        <EmployeeEditModal
          employee={mockEmployee}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to edit this profile")).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(
      <TestWrapper>
        <EmployeeEditModal
          employee={mockEmployee}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </TestWrapper>
    );

    // Clear required fields
    const firstNameInput = screen.getByDisplayValue('John');
    const lastNameInput = screen.getByDisplayValue('Doe');
    const emailInput = screen.getByDisplayValue('john.doe@example.com');

    fireEvent.change(firstNameInput, { target: { value: '' } });
    fireEvent.change(lastNameInput, { target: { value: '' } });
    fireEvent.change(emailInput, { target: { value: '' } });

    // Submit form
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('First name is required')).toBeInTheDocument();
      expect(screen.getByText('Last name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    expect(mockEmployeeAPI.updateEmployee).not.toHaveBeenCalled();
  });

  it('should validate email format', async () => {
    render(
      <TestWrapper>
        <EmployeeEditModal
          employee={mockEmployee}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </TestWrapper>
    );

    const emailInput = screen.getByDisplayValue('john.doe@example.com');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    expect(mockEmployeeAPI.updateEmployee).not.toHaveBeenCalled();
  });

  it('should handle skill management', () => {
    render(
      <TestWrapper>
        <EmployeeEditModal
          employee={mockEmployee}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </TestWrapper>
    );

    // Check existing skills are displayed
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();

    // Add new skill
    const skillInput = screen.getByPlaceholderText('Add a skill...');
    fireEvent.change(skillInput, { target: { value: 'TypeScript' } });
    fireEvent.click(screen.getByText('Add'));

    expect(screen.getByText('TypeScript')).toBeInTheDocument();

    // Remove skill
    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]); // Remove first skill

    // JavaScript should be removed
    expect(screen.queryByText('JavaScript')).not.toBeInTheDocument();
  });

  it('should successfully update employee profile', async () => {
    const updatedEmployee = { ...mockEmployee, firstName: 'Jane' };
    mockEmployeeAPI.updateEmployee.mockResolvedValue(updatedEmployee);

    render(
      <TestWrapper>
        <EmployeeEditModal
          employee={mockEmployee}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </TestWrapper>
    );

    // Update first name
    const firstNameInput = screen.getByDisplayValue('John');
    fireEvent.change(firstNameInput, { target: { value: 'Jane' } });

    // Submit form
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockEmployeeAPI.updateEmployee).toHaveBeenCalledWith({
        id: 'emp-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        title: 'Software Engineer',
        department: 'Engineering',
        officeLocation: 'New York',
        skills: ['JavaScript', 'React'],
        bio: 'Experienced software engineer',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
    });

    expect(mockOnSave).toHaveBeenCalledWith(updatedEmployee);
  });

  it('should handle API errors', async () => {
    const errorMessage = 'Failed to update profile';
    mockEmployeeAPI.updateEmployee.mockRejectedValue({
      response: { data: { error: { message: errorMessage } } },
    });

    render(
      <TestWrapper>
        <EmployeeEditModal
          employee={mockEmployee}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </TestWrapper>
    );

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should handle photo upload', async () => {
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    const photoResult = { photoUrl: 'https://example.com/new-photo.jpg' };
    
    mockEmployeeAPI.updateEmployee.mockResolvedValue(mockEmployee);
    mockEmployeeAPI.uploadProfilePhoto.mockResolvedValue(photoResult);

    render(
      <TestWrapper>
        <EmployeeEditModal
          employee={mockEmployee}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </TestWrapper>
    );

    // Upload photo
    const fileInput = screen.getByLabelText(/profile photo/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Submit form
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockEmployeeAPI.uploadProfilePhoto).toHaveBeenCalledWith('emp-1', file);
    });
  });

  it('should close modal when cancel is clicked', () => {
    render(
      <TestWrapper>
        <EmployeeEditModal
          employee={mockEmployee}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </TestWrapper>
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});