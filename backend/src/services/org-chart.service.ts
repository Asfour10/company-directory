import { EmployeeRepository } from '../repositories/employee.repository';
import { AuditService } from './audit.service';
import { NotFoundError } from '../utils/errors';

export interface OrgChartNode {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  department?: string;
  email: string;
  photoUrl?: string;
  managerId?: string;
  children: OrgChartNode[];
  level: number;
}

export interface OrgChartServiceContext {
  tenantId: string;
  userId?: string;
  userRole?: string;
}

/**
 * Service for organizational chart operations
 * Builds hierarchical tree structures from flat employee data
 */
export class OrgChartService {
  /**
   * Get complete organizational chart for tenant
   */
  static async getOrganizationalChart(context: OrgChartServiceContext): Promise<OrgChartNode[]> {
    // Get all active employees for the tenant
    const result = await EmployeeRepository.findMany(
      context.tenantId,
      { isActive: true },
      { pageSize: 10000 } // Get all employees
    );

    const employees = result.employees;

    // Build the organizational tree
    const orgChart = this.buildOrganizationalTree(employees);

    // Track analytics event
    if (context.userId) {
      await AuditService.trackEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        eventType: 'org_chart_viewed',
        metadata: {
          totalEmployees: employees.length,
          rootNodes: orgChart.length,
        },
      });
    }

    return orgChart;
  }

  /**
   * Get organizational chart starting from a specific employee
   */
  static async getOrganizationalChartFromEmployee(
    employeeId: string,
    context: OrgChartServiceContext
  ): Promise<OrgChartNode> {
    // Get the specific employee
    const employee = await EmployeeRepository.findById(context.tenantId, employeeId);

    // Get all employees to build the complete tree
    const result = await EmployeeRepository.findMany(
      context.tenantId,
      { isActive: true },
      { pageSize: 10000 }
    );

    const employees = result.employees;

    // Build the tree and find the specific node
    const fullTree = this.buildOrganizationalTree(employees);
    const targetNode = this.findNodeInTree(fullTree, employeeId);

    if (!targetNode) {
      throw new NotFoundError('Employee not found in organizational chart', employeeId);
    }

    // Track analytics event
    if (context.userId) {
      await AuditService.trackEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        eventType: 'org_chart_employee_viewed',
        metadata: {
          targetEmployeeId: employeeId,
          targetEmployeeDepartment: employee.department,
          targetEmployeeTitle: employee.title,
        },
      });
    }

    return targetNode;
  }

  /**
   * Get management chain for a specific employee
   */
  static async getManagementChain(
    employeeId: string,
    context: OrgChartServiceContext
  ): Promise<OrgChartNode[]> {
    // Get the management chain from repository
    const managementChain = await EmployeeRepository.getManagementChain(context.tenantId, employeeId);

    // Convert to OrgChartNode format
    const chainNodes: OrgChartNode[] = managementChain.map((manager, index) => ({
      id: manager.id,
      firstName: manager.firstName,
      lastName: manager.lastName,
      title: manager.title,
      department: undefined, // Not included in management chain query
      email: '', // Not included in management chain query
      photoUrl: undefined,
      managerId: manager.managerId,
      children: [],
      level: index,
    }));

    // Track analytics event
    if (context.userId) {
      await AuditService.trackEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        eventType: 'management_chain_viewed',
        metadata: {
          employeeId,
          chainLength: chainNodes.length,
        },
      });
    }

    return chainNodes;
  }

  /**
   * Get direct reports for a specific employee
   */
  static async getDirectReports(
    employeeId: string,
    context: OrgChartServiceContext
  ): Promise<OrgChartNode[]> {
    // Get direct reports from repository
    const directReports = await EmployeeRepository.findByManager(context.tenantId, employeeId);

    // Convert to OrgChartNode format
    const reportNodes: OrgChartNode[] = directReports.map(report => ({
      id: report.id,
      firstName: report.firstName,
      lastName: report.lastName,
      title: report.title,
      department: report.department,
      email: report.email,
      photoUrl: undefined, // Not included in direct reports query
      managerId: employeeId,
      children: [],
      level: 0, // Will be calculated when building full tree
    }));

    // Track analytics event
    if (context.userId) {
      await AuditService.trackEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        eventType: 'direct_reports_viewed',
        metadata: {
          managerId: employeeId,
          reportsCount: reportNodes.length,
        },
      });
    }

    return reportNodes;
  }

  /**
   * Get organizational statistics
   */
  static async getOrganizationalStats(context: OrgChartServiceContext) {
    // Get all active employees
    const result = await EmployeeRepository.findMany(
      context.tenantId,
      { isActive: true },
      { pageSize: 10000 }
    );

    const employees = result.employees;

    // Calculate statistics
    const totalEmployees = employees.length;
    const managersCount = employees.filter(emp => 
      employees.some(other => other.managerId === emp.id)
    ).length;
    const topLevelEmployees = employees.filter(emp => !emp.managerId).length;

    // Calculate department hierarchy depth
    const orgChart = this.buildOrganizationalTree(employees);
    const maxDepth = this.calculateMaxDepth(orgChart);

    // Calculate average span of control
    const managersWithReports = employees.filter(emp => 
      employees.some(other => other.managerId === emp.id)
    );
    const totalReports = managersWithReports.reduce((sum, manager) => {
      return sum + employees.filter(emp => emp.managerId === manager.id).length;
    }, 0);
    const avgSpanOfControl = managersWithReports.length > 0 ? 
      Math.round((totalReports / managersWithReports.length) * 10) / 10 : 0;

    const stats = {
      totalEmployees,
      managersCount,
      topLevelEmployees,
      maxHierarchyDepth: maxDepth,
      averageSpanOfControl: avgSpanOfControl,
      departmentDistribution: this.calculateDepartmentDistribution(employees),
    };

    // Track analytics event
    if (context.userId) {
      await AuditService.trackEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        eventType: 'org_stats_viewed',
        metadata: stats,
      });
    }

    return stats;
  }

  /**
   * Build organizational tree from flat employee data
   */
  private static buildOrganizationalTree(employees: any[]): OrgChartNode[] {
    // Create a map for quick lookup
    const employeeMap = new Map<string, OrgChartNode>();
    
    // Convert employees to OrgChartNode format
    employees.forEach(emp => {
      employeeMap.set(emp.id, {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        title: emp.title,
        department: emp.department,
        email: emp.email,
        photoUrl: emp.photoUrl,
        managerId: emp.managerId,
        children: [],
        level: 0, // Will be calculated later
      });
    });

    // Build the tree structure
    const rootNodes: OrgChartNode[] = [];

    employeeMap.forEach(node => {
      if (node.managerId && employeeMap.has(node.managerId)) {
        // Add as child to manager
        const manager = employeeMap.get(node.managerId)!;
        manager.children.push(node);
      } else {
        // Top-level employee (no manager or manager not found)
        rootNodes.push(node);
      }
    });

    // Calculate levels and sort children
    this.calculateLevelsAndSort(rootNodes, 0);

    return rootNodes;
  }

  /**
   * Calculate levels for each node and sort children by name
   */
  private static calculateLevelsAndSort(nodes: OrgChartNode[], level: number): void {
    nodes.forEach(node => {
      node.level = level;
      
      // Sort children by last name, then first name
      node.children.sort((a, b) => {
        const lastNameCompare = a.lastName.localeCompare(b.lastName);
        if (lastNameCompare !== 0) return lastNameCompare;
        return a.firstName.localeCompare(b.firstName);
      });

      // Recursively process children
      if (node.children.length > 0) {
        this.calculateLevelsAndSort(node.children, level + 1);
      }
    });

    // Sort root nodes by last name, then first name
    nodes.sort((a, b) => {
      const lastNameCompare = a.lastName.localeCompare(b.lastName);
      if (lastNameCompare !== 0) return lastNameCompare;
      return a.firstName.localeCompare(b.firstName);
    });
  }

  /**
   * Find a specific node in the organizational tree
   */
  private static findNodeInTree(nodes: OrgChartNode[], targetId: string): OrgChartNode | null {
    for (const node of nodes) {
      if (node.id === targetId) {
        return node;
      }
      
      const found = this.findNodeInTree(node.children, targetId);
      if (found) {
        return found;
      }
    }
    
    return null;
  }

  /**
   * Calculate maximum depth of the organizational tree
   */
  private static calculateMaxDepth(nodes: OrgChartNode[]): number {
    if (nodes.length === 0) return 0;

    let maxDepth = 0;
    
    nodes.forEach(node => {
      const childDepth = this.calculateMaxDepth(node.children);
      maxDepth = Math.max(maxDepth, 1 + childDepth);
    });

    return maxDepth;
  }

  /**
   * Calculate department distribution
   */
  private static calculateDepartmentDistribution(employees: any[]) {
    const departmentCounts = new Map<string, number>();
    
    employees.forEach(emp => {
      const dept = emp.department || 'Unassigned';
      departmentCounts.set(dept, (departmentCounts.get(dept) || 0) + 1);
    });

    return Array.from(departmentCounts.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Validate organizational structure integrity
   */
  static async validateOrganizationalStructure(context: OrgChartServiceContext) {
    const result = await EmployeeRepository.findMany(
      context.tenantId,
      { isActive: true },
      { pageSize: 10000 }
    );

    const employees = result.employees;
    const issues: string[] = [];

    // Check for circular references
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const checkCircular = (employeeId: string): boolean => {
      if (recursionStack.has(employeeId)) {
        issues.push(`Circular reference detected involving employee ${employeeId}`);
        return true;
      }

      if (visited.has(employeeId)) {
        return false;
      }

      visited.add(employeeId);
      recursionStack.add(employeeId);

      const employee = employees.find(emp => emp.id === employeeId);
      if (employee?.managerId) {
        if (checkCircular(employee.managerId)) {
          return true;
        }
      }

      recursionStack.delete(employeeId);
      return false;
    };

    // Check each employee for circular references
    employees.forEach(emp => {
      if (!visited.has(emp.id)) {
        checkCircular(emp.id);
      }
    });

    // Check for orphaned managers (managers who don't exist)
    employees.forEach(emp => {
      if (emp.managerId) {
        const managerExists = employees.some(mgr => mgr.id === emp.managerId);
        if (!managerExists) {
          issues.push(`Employee ${emp.firstName} ${emp.lastName} has non-existent manager ${emp.managerId}`);
        }
      }
    });

    return {
      isValid: issues.length === 0,
      issues,
      totalEmployees: employees.length,
      checkedAt: new Date().toISOString(),
    };
  }
}