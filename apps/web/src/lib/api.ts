const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('mes_auth_token', token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('mes_auth_token');
    }
    return null;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('mes_auth_token');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status} ${res.statusText}`;
      try {
        const errorBody = await res.json();
        errorMessage = errorBody.message || errorMessage;
      } catch {
        // fallback
      }
      throw new Error(errorMessage);
    }

    return res.json();
  }

  // Auth
  async login(credentials: { usernameOrEmail: string; password: string }) {
    const res = await this.request<{ accessToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(res.accessToken);
    return res;
  }

  async getProfile() {
    return this.request<any>('/auth/me');
  }

  async getUsers() {
    return this.request<any[]>('/auth/users');
  }

  // Dashboard
  async getDashboardMetrics() {
    return this.request<{
      kpi: {
        totalPrograms: number;
        activePrograms: number;
        totalChallans: number;
        activeChallans: number;
        totalInput: number;
        totalGood: number;
        totalReject: number;
        totalRework: number;
        totalWaste: number;
        overallYield: string;
        rejectionRate: string;
        reworkRate: string;
      };
      recentInspections: any[];
      recentActivity: any[];
    }>('/dashboard/metrics');
  }

  // Programs
  async getPrograms(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    return this.request<any[]>(`/programs?${query.toString()}`);
  }

  async getProgram(id: string) {
    return this.request<any>(`/programs/${id}`);
  }

  async createProgram(data: any) {
    return this.request<any>('/programs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProgramStatus(id: string, status: string) {
    return this.request<any>(`/programs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Challans
  async getChallans(params?: {
    department?: string;
    fromDepartment?: string;
    toDepartment?: string;
    status?: string;
    programId?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.department) query.append('department', params.department);
    if (params?.fromDepartment) query.append('fromDepartment', params.fromDepartment);
    if (params?.toDepartment) query.append('toDepartment', params.toDepartment);
    if (params?.status) query.append('status', params.status);
    if (params?.programId) query.append('programId', params.programId);
    return this.request<any[]>(`/challans?${query.toString()}`);
  }

  async getChallan(id: string) {
    return this.request<any>(`/challans/${id}`);
  }

  async getNextChallanNumber(department: string) {
    return this.request<{ nextNumber: string }>(`/challans/next-number?department=${department}`);
  }

  async createChallan(data: any) {
    return this.request<any>('/challans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChallanStatus(id: string, status: string, notes?: string) {
    return this.request<any>(`/challans/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  }

  async getGenealogy(id: string) {
    return this.request<{
      currentChallan: any;
      ancestors: any[];
      descendants: any[];
    }>(`/challans/${id}/genealogy`);
  }

  // Production
  async recordProduction(data: any) {
    return this.request<any>('/production/record', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProductionHistory(params?: { programId?: string; departmentCode?: string }) {
    const query = new URLSearchParams();
    if (params?.programId) query.append('programId', params.programId);
    if (params?.departmentCode) query.append('departmentCode', params.departmentCode);
    return this.request<any[]>(`/production/history?${query.toString()}`);
  }

  // Quality
  async recordInspection(data: any) {
    return this.request<any>('/quality/inspect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInspections(params?: { challanId?: string; programId?: string }) {
    const query = new URLSearchParams();
    if (params?.challanId) query.append('challanId', params.challanId);
    if (params?.programId) query.append('programId', params.programId);
    return this.request<any[]>(`/quality/inspections?${query.toString()}`);
  }

  // Departments
  async getDepartments() {
    return this.request<any[]>('/departments');
  }

  // Audit
  async getAuditLogs(params?: { entity?: string; action?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.entity) query.append('entity', params.entity);
    if (params?.action) query.append('action', params.action);
    if (params?.limit) query.append('limit', String(params.limit));
    return this.request<{ total: number; records: any[] }>(`/audit?${query.toString()}`);
  }

  // Health
  async getHealth() {
    return this.request<any>('/health');
  }
}

export const api = new ApiClient();
