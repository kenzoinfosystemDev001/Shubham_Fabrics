const getBaseUrl = () => {
  if (typeof window !== 'undefined') return '/api';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api`;
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
};

const API_BASE_URL = getBaseUrl();

class ApiClient {
  /**
   * The session lives in an httpOnly cookie set by /api/auth/login, so the browser never
   * holds the token itself. A stored user profile only means "show the signed-in UI".
   */
  hasSession(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(localStorage.getItem('subham_mes_user'));
  }

  /** Signs out: clears the server session cookie and any locally cached profile. */
  clearToken() {
    if (typeof window !== 'undefined') {
      fetch('/api/auth/logout', { method: 'POST', keepalive: true }).catch(() => {});
      sessionStorage.removeItem('mes_auth_token');
      localStorage.removeItem('subham_mes_token');
      localStorage.removeItem('subham_mes_user');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const url = `${API_BASE_URL}${endpoint}`;
    
    // Generous 60-second timeout to handle remote cloud database latency
    const timeoutMs = options.timeoutMs ?? 60000;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try {
        controller.abort(new Error('Request timed out. Please check your connection and try again.'));
      } catch {
        controller.abort();
      }
    }, timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        if (res.status === 401 && typeof window !== 'undefined' && endpoint !== '/auth/login') {
          localStorage.removeItem('subham_mes_user');
          if (window.location.pathname !== '/login') {
            window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          }
        }
        let errorMessage = `HTTP ${res.status} ${res.statusText}`;
        try {
          const errorBody = await res.json();
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch {
          // fallback
        }
        throw new Error(errorMessage);
      }

      return res.json();
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError' || err.message?.toLowerCase().includes('abort')) {
        throw new Error('Connection timed out. Please check your network connection and retry.');
      }
      throw err;
    }
  }

  // Auth
  async login(credentials: { usernameOrEmail: string; password: string }) {
    return this.request<{ user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async getProfile() {
    return this.request<any>('/auth/me');
  }

  async getUsers() {
    try {
      return await this.request<any[]>('/auth/users');
    } catch {
      return [
        { id: '1', username: 'admin', fullName: 'System Administrator', role: 'SUPER_ADMIN', departmentCode: 'CENTRAL', isActive: true },
        { id: '2', username: 'jitender', fullName: 'jitender saini', role: 'STORE_MANAGER', departmentCode: 'STORE', isActive: true },
        { id: '3', username: 'prod_manager', fullName: 'Production Manager', role: 'PRODUCTION_MANAGER', departmentCode: 'CUTTING', isActive: true },
        { id: '4', username: 'qc_insp', fullName: 'Quality Inspector', role: 'QC_INSPECTOR', departmentCode: 'QC1', isActive: true },
      ];
    }
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

  // Programs & Production Sheets
  async getNextProgramNumber() {
    try {
      return await this.request<{ nextNumber: string }>('/programs/next-number');
    } catch {
      return { nextNumber: `PRG-${new Date().getFullYear()}-00001` };
    }
  }

  async getPrograms(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    return this.request<any[]>(`/programs?${query.toString()}`);
  }

  async getProgram(id: string) {
    return this.request<any>(`/programs/${id}`);
  }

  async createProductionSheet(data: any) {
    return this.request<any>('/programs/production-sheet', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getFabricAvailability(params: {
    fabricName: string;
    fabricColor?: string;
    fabricAverage: number;
    productionQuantity: number;
  }) {
    const query = new URLSearchParams({
      fabricName: params.fabricName,
      fabricAverage: String(params.fabricAverage),
      productionQuantity: String(params.productionQuantity),
    });
    if (params.fabricColor) query.set('fabricColor', params.fabricColor);
    return this.request<{
      fabricName: string;
      fabricColor: string | null;
      availableMeters: number;
      requiredMeters: number;
      matchingRollCount: number;
      sufficient: boolean;
    }>(`/programs/production-sheet?${query.toString()}`);
  }

  async updateProductionSheet(id: string, data: any) {
    return this.request<any>(`/programs/${id}/production-sheet`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
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

  // Masters
  async getMasters(resource: string, params?: { search?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    return this.request<any[]>(`/masters/${resource}?${query.toString()}`);
  }

  async createMaster(resource: string, data: any) {
    return this.request<any>(`/masters/${resource}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMaster(resource: string, id: string, data: any) {
    return this.request<any>(`/masters/${resource}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteMaster(resource: string, id: string) {
    return this.request<any>(`/masters/${resource}/${id}`, {
      method: 'DELETE',
    });
  }

  // Floor Board & Real-Time Engine
  async getFloorBoardState() {
    return this.request<any>('/floorboard/state');
  }

  // Inventory & Stock Ledger
  async getStockLedger(params?: { departmentCode?: string; itemCode?: string; rollNumber?: string }) {
    const query = new URLSearchParams();
    if (params?.departmentCode) query.append('departmentCode', params.departmentCode);
    if (params?.itemCode) query.append('itemCode', params.itemCode);
    if (params?.rollNumber) query.append('rollNumber', params.rollNumber);
    return this.request<any[]>(`/inventory/ledger?${query.toString()}`);
  }

  async getStockSummary(departmentCode?: string) {
    const query = new URLSearchParams();
    if (departmentCode) query.append('departmentCode', departmentCode);
    return this.request<any[]>(`/inventory/summary?${query.toString()}`);
  }

  async getFabricRolls(params?: { programId?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.programId) query.append('programId', params.programId);
    if (params?.status) query.append('status', params.status);
    return this.request<any[]>(`/inventory/rolls?${query.toString()}`);
  }

  async registerFabricRoll(data: any) {
    return this.request<any>('/inventory/rolls', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async issueFabricRoll(data: { rollNumber: string; targetDepartment: string; challanId: string }) {
    return this.request<any>('/inventory/rolls/issue', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Bundles
  async getBundles(params?: { programId?: string; currentDepartment?: string; status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.programId) query.append('programId', params.programId);
    if (params?.currentDepartment) query.append('currentDepartment', params.currentDepartment);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    return this.request<any[]>(`/bundles?${query.toString()}`);
  }

  async createBundles(data: any) {
    return this.request<any>('/bundles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async transferBundle(id: string, departmentCode: string, status: string) {
    return this.request<any>(`/bundles/${id}/transfer`, {
      method: 'PATCH',
      body: JSON.stringify({ departmentCode, status }),
    });
  }

  // Defects & Rework
  async getDefects(params?: { programId?: string; departmentCode?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.programId) query.append('programId', params.programId);
    if (params?.departmentCode) query.append('departmentCode', params.departmentCode);
    if (params?.status) query.append('status', params.status);
    return this.request<any[]>(`/defects?${query.toString()}`);
  }

  async createDefect(data: any) {
    return this.request<any>('/defects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDefectStatus(id: string, status: string, resolutionNotes?: string) {
    return this.request<any>(`/defects/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resolutionNotes }),
    });
  }

  async createRework(data: any) {
    return this.request<any>('/defects/reworks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRecuts(params?: { programId?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.programId) query.append('programId', params.programId);
    if (params?.status) query.append('status', params.status);
    return this.request<any[]>(`/defects/recuts?${query.toString()}`);
  }

  async createRecut(data: any) {
    return this.request<any>('/defects/recuts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async approveRecut(id: string) {
    return this.request<any>(`/defects/recuts/${id}/approve`, {
      method: 'POST',
    });
  }

  // Packing & FG
  async getCartons(params?: { programId?: string; status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.programId) query.append('programId', params.programId);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    return this.request<any[]>(`/packing/cartons?${query.toString()}`);
  }

  async packCarton(data: any) {
    return this.request<any>('/packing/cartons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Dispatch
  async getDispatches(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    return this.request<any[]>(`/dispatch?${query.toString()}`);
  }

  async createDispatch(data: any) {
    return this.request<any>('/dispatch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Challan Action
  async executeChallanAction(id: string, action: string, payload?: { reason?: string; notes?: string }) {
    return this.request<any>(`/challans/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload }),
    });
  }

  // Comprehensive QC
  async recordComprehensiveQC(data: any) {
    return this.request<any>('/quality/comprehensive-inspect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Packing & Finished Goods Inventory
  async getPackingDashboard() {
    return this.request<any>('/packing/dashboard');
  }

  async getPackingIncoming(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.search) query.append("search", params.search);
    return this.request<any>("/packing/incoming?" + query.toString());
  }

  async receivePackingChallan(id: string, data: { receivedQuantity?: number; remarks?: string; markOnHold?: boolean }) {
    return this.request<any>("/packing/challans/" + id + "/receive", {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPackingQueue(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.search) query.append("search", params.search);
    return this.request<any>("/packing/queue?" + query.toString());
  }

  async getPackingJob(id: string) {
    return this.request<any>("/packing/jobs/" + id);
  }

  async packJob(id: string, data: any) {
    return this.request<any>("/packing/jobs/" + id + "/pack", {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getFinishedGoodsInventory(params?: { search?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.status) query.append("status", params.status);
    return this.request<any>("/packing/inventory?" + query.toString());
  }

  async getPackingReports(days: number = 30) {
    return this.request<any>("/packing/reports?days=" + days);
  }

  // Health
  async getHealth() {
    return this.request<any>('/health');
  }
}

export const api = new ApiClient();
